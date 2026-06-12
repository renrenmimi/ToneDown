import type { SessionRecord } from '@/shared/storage/records'
import type { Locale } from '@/shared/i18n/localeContext'
import { recapT } from './i18n'

// Hand-drawn share card: 1200x630 (OG ratio) at 2x devicePixelRatio.
// Deliberately NOT html2canvas (~48KB + fidelity roulette): the card is a
// brand artifact, so it always renders the dark identity regardless of the
// user's theme, with fixed token hexes below.

const W = 1200
const H = 630
const SCALE = 2

const C = {
  bgTop: '#0a1422',
  bgBottom: '#101d30',
  teal: '#3ccfbc',
  indigo: '#7c8ce4',
  amber: '#fbbf24',
  hostile: '#de6470',
  ink: '#edf4f8',
  inkSecondary: '#a8bccc',
  inkMuted: '#6e8499',
  line: '#1e3048',
  sunken: '#060d17',
}

const SITE = 'tone-down.vercel.app'
const DISPLAY = '"Space Grotesk Variable", "Space Grotesk", sans-serif'
const SANS =
  '"Source Sans 3 Variable", "Source Sans 3", -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif'

const toneFor = (score: number) =>
  score <= 30 ? C.teal : score <= 55 ? C.amber : score <= 75 ? '#f8924f' : C.hostile

/** Bilingual wrap: Intl.Segmenter words when available, per-char CJK fallback. */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  let units: string[]
  if (typeof Intl.Segmenter !== 'undefined') {
    units = [...new Intl.Segmenter(undefined, { granularity: 'word' }).segment(text)].map(
      (s) => s.segment,
    )
  } else {
    units = text.split(/(\s+)/).flatMap((w) => (/[一-鿿]/.test(w) ? [...w] : [w]))
  }

  const lines: string[] = []
  let current = ''
  for (const unit of units) {
    const candidate = current + unit
    if (ctx.measureText(candidate).width > maxWidth && current.trim().length > 0) {
      lines.push(current.trimEnd())
      current = unit.trimStart()
      if (lines.length === maxLines) {
        break
      }
    } else {
      current = candidate
    }
  }
  if (lines.length < maxLines && current.trim().length > 0) {
    lines.push(current.trimEnd())
  }
  if (lines.length === maxLines && current.trim().length > 0 && !lines.includes(current.trimEnd())) {
    lines[maxLines - 1] = lines[maxLines - 1].replace(/.{1}$/, '') + '…'
  }
  return lines
}

function drawBackground(ctx: CanvasRenderingContext2D): void {
  const gradient = ctx.createLinearGradient(0, 0, 0, H)
  gradient.addColorStop(0, C.bgTop)
  gradient.addColorStop(1, C.bgBottom)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, W, H)

  // frozen aurora
  const blob1 = ctx.createRadialGradient(280, 180, 0, 280, 180, 420)
  blob1.addColorStop(0, 'rgba(60, 207, 188, 0.10)')
  blob1.addColorStop(1, 'rgba(60, 207, 188, 0)')
  ctx.fillStyle = blob1
  ctx.fillRect(0, 0, W, H)
  const blob2 = ctx.createRadialGradient(880, 480, 0, 880, 480, 460)
  blob2.addColorStop(0, 'rgba(124, 140, 228, 0.09)')
  blob2.addColorStop(1, 'rgba(124, 140, 228, 0)')
  ctx.fillStyle = blob2
  ctx.fillRect(0, 0, W, H)
}

function drawSparkline(
  ctx: CanvasRenderingContext2D,
  record: SessionRecord,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  ctx.fillStyle = C.sunken
  ctx.fillRect(x, y, width, height)

  const px = (ms: number) => x + (ms / Math.max(1, record.durationMs)) * width
  const py = (score: number) => y + (1 - score / 100) * height

  ctx.lineWidth = 3
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  const series = record.scoreSeries
  // band-colored segments
  for (let i = 1; i < series.length; i += 1) {
    const [ms0, s0] = series[i - 1]
    const [ms1, s1] = series[i]
    ctx.strokeStyle = toneFor(Math.max(s0, s1))
    ctx.beginPath()
    ctx.moveTo(px(ms0), py(s0))
    ctx.lineTo(px(ms1), py(s1))
    ctx.stroke()
  }
  // flagged dots
  ctx.fillStyle = C.hostile
  for (const moment of record.flaggedMoments) {
    ctx.beginPath()
    ctx.arc(px(moment.atMs), y + height - 8, 5, 0, Math.PI * 2)
    ctx.fill()
  }
}

export async function renderRecapPng(record: SessionRecord, locale: Locale): Promise<Blob> {
  const copy = recapT(locale)

  await document.fonts.ready
  // Variable-font canvas quirk (Safari): load the exact weights drawn below.
  await Promise.all([
    document.fonts.load(`700 140px ${DISPLAY}`),
    document.fonts.load(`700 44px ${DISPLAY}`),
    document.fonts.load(`400 24px ${SANS}`),
    document.fonts.load(`600 26px ${SANS}`),
  ]).catch(() => undefined)

  const canvas = document.createElement('canvas')
  canvas.width = W * SCALE
  canvas.height = H * SCALE
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('canvas 2d unavailable')
  }
  ctx.scale(SCALE, SCALE)

  drawBackground(ctx)

  // header
  ctx.fillStyle = C.teal
  ctx.font = `700 44px ${DISPLAY}`
  ctx.fillText('ToneDown', 48, 76)
  ctx.fillStyle = C.inkSecondary
  ctx.font = `400 24px ${SANS}`
  const date = new Date(record.startedAt)
  const dur = `${String(Math.floor(record.durationMs / 60000)).padStart(2, '0')}:${String(Math.round(record.durationMs / 1000) % 60).padStart(2, '0')}`
  ctx.fillText(`${date.toLocaleDateString(locale)} · ${dur} · ${record.language}`, 48, 112)

  // left column: calm score + summary
  const tone = record.calmScore >= 60 ? C.teal : C.amber
  ctx.fillStyle = tone
  ctx.font = `700 140px ${DISPLAY}`
  ctx.fillText(String(record.calmScore), 48, 280)
  ctx.fillStyle = C.inkMuted
  ctx.font = `600 22px ${SANS}`
  ctx.fillText(copy.calmScoreLabel.toUpperCase(), 52, 316)

  if (record.debrief) {
    ctx.fillStyle = C.ink
    ctx.font = `400 24px ${SANS}`
    const lines = wrapText(ctx, record.debrief.summary, 540, 3)
    lines.forEach((line, i) => ctx.fillText(line, 48, 368 + i * 34))
  }

  // sparkline
  drawSparkline(ctx, record, 48, 470, 540, 110)

  // right column: trigger moments + habit
  let cursorY = 180
  const rightX = 660
  const rightW = 492
  ctx.fillStyle = C.inkMuted
  ctx.font = `600 20px ${SANS}`
  if (record.debrief && record.debrief.trigger_moments.length > 0) {
    ctx.fillText(copy.triggersTitle.toUpperCase(), rightX, cursorY - 28)
    for (const moment of record.debrief.trigger_moments.slice(0, 3)) {
      ctx.fillStyle = C.hostile
      ctx.beginPath()
      ctx.arc(rightX + 6, cursorY - 7, 5, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = C.ink
      ctx.font = `600 22px ${SANS}`
      const quote = wrapText(ctx, `“${moment.quote}”`, rightW - 28, 2)
      quote.forEach((line, i) => ctx.fillText(line, rightX + 22, cursorY + i * 28))
      cursorY += quote.length * 28 + 4
      ctx.fillStyle = C.teal
      ctx.font = `400 20px ${SANS}`
      const better = wrapText(ctx, `→ ${moment.better_phrasing}`, rightW - 28, 2)
      better.forEach((line, i) => ctx.fillText(line, rightX + 22, cursorY + i * 26))
      cursorY += better.length * 26 + 26
    }
  }

  if (record.debrief) {
    ctx.strokeStyle = C.amber
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.moveTo(rightX, cursorY - 8)
    ctx.lineTo(rightX, cursorY + 64)
    ctx.stroke()
    ctx.fillStyle = C.inkMuted
    ctx.font = `600 20px ${SANS}`
    ctx.fillText(copy.habitTitle.toUpperCase(), rightX + 18, cursorY + 12)
    ctx.fillStyle = C.ink
    ctx.font = `400 22px ${SANS}`
    const habit = wrapText(ctx, record.debrief.one_habit_to_practice, rightW - 18, 2)
    habit.forEach((line, i) => ctx.fillText(line, rightX + 18, cursorY + 42 + i * 28))
  }

  // footer
  ctx.strokeStyle = C.line
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(48, 596)
  ctx.lineTo(W - 48, 596)
  ctx.stroke()
  ctx.fillStyle = C.inkMuted
  ctx.font = `400 18px ${SANS}`
  const privacy =
    locale === 'zh-CN'
      ? '实时分析，从不录音 · Analyzed live — no audio was ever stored'
      : 'Analyzed live — no audio was ever stored · 实时分析，从不录音'
  ctx.fillText(privacy, 48, 620)
  ctx.textAlign = 'right'
  ctx.fillStyle = C.teal
  ctx.fillText(SITE, W - 48, 620)
  ctx.textAlign = 'left'

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))),
      'image/png',
    )
  })
}

export async function downloadRecapPng(record: SessionRecord, locale: Locale): Promise<void> {
  const blob = await renderRecapPng(record, locale)
  const filename = `tonedown-recap-${new Date(record.startedAt).toISOString().slice(0, 10)}.png`

  const file = new File([blob], filename, { type: 'image/png' })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
      return
    } catch {
      // user cancelled or share failed: fall through to download
    }
  }

  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
