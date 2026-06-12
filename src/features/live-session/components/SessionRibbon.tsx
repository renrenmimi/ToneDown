import { useEffect, useState } from 'react'
import type { EmotionLevel } from '@/types/app'
import { useLiveSessionT } from '../i18n'
import type { FlaggedMoment } from '../machine/sessionMachine'
import { useIsSessionActive, useScoreHistory, useSession } from '../machine/selectors'

// Bottom-docked session timeline: the last 10 minutes at 2s resolution as
// one SVG of run-length-merged tone rects (≤300 samples → typically 30-120
// nodes; no virtualization needed), with HTML buttons over it marking the
// hostile moments the coach flagged. Clicking a marker opens the quote and
// the rewrite that was offered.

const WINDOW_MS = 10 * 60_000
const SAMPLE_MS = 2_000
const VIEW_W = 600
const VIEW_H = 32

const LEVEL_FILL: Record<EmotionLevel, string> = {
  calm: 'var(--tone-calm)',
  elevated: 'var(--tone-tense)',
  heated: 'var(--tone-heated)',
  critical: 'var(--tone-hostile)',
}

interface Segment {
  x: number
  width: number
  level: EmotionLevel
}

function mergeSegments(
  history: { timestamp: number; emotionLevel: EmotionLevel }[],
  start: number,
): Segment[] {
  const segments: Segment[] = []
  for (const point of history) {
    if (point.timestamp < start) {
      continue
    }
    const x = ((point.timestamp - start) / WINDOW_MS) * VIEW_W
    const width = (SAMPLE_MS / WINDOW_MS) * VIEW_W
    const last = segments[segments.length - 1]
    // Run-length merge: extend the previous rect when contiguous + same band.
    if (last && last.level === point.emotionLevel && x - (last.x + last.width) < width) {
      last.width = x + width - last.x
    } else {
      segments.push({ x, width, level: point.emotionLevel })
    }
  }
  return segments
}

function formatClock(at: number, startedAt: number | null): string {
  const elapsed = Math.max(0, Math.floor((at - (startedAt ?? at)) / 1000))
  return `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`
}

export function SessionRibbon() {
  const copy = useLiveSessionT()
  const isActive = useIsSessionActive()
  const history = useScoreHistory()
  const flagged = useSession((s) => s.flaggedMoments)
  const startedAt = useSession((s) => s.startedAt)

  const [now, setNow] = useState(() => Date.now())
  const [openMoment, setOpenMoment] = useState<FlaggedMoment | null>(null)

  useEffect(() => {
    if (!isActive) {
      return
    }
    const id = window.setInterval(() => setNow(Date.now()), 1_000)
    return () => window.clearInterval(id)
  }, [isActive])

  useEffect(() => {
    if (!openMoment) {
      return
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenMoment(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openMoment])

  if (!isActive || history.length < 2) {
    return null
  }

  const start = now - WINDOW_MS
  const segments = mergeSegments(history, start)
  const visibleFlags = flagged.filter((m) => m.at >= start)

  return (
    <div
      role="group"
      aria-label={copy.ribbon.label}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-raised/90 px-4 pb-3 pt-2 backdrop-blur"
    >
      {openMoment && (
        <div
          role="dialog"
          aria-label={copy.ribbon.flagged}
          className="absolute bottom-full left-1/2 mb-2 w-[min(92vw,26rem)] -translate-x-1/2 rounded-card border border-line bg-overlay/95 p-4 shadow-e3"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs text-ink-muted">
              {copy.ribbon.flagged} · {formatClock(openMoment.at, startedAt)}
            </p>
            <button
              type="button"
              className="-m-1 p-1 text-xs text-ink-muted hover:text-ink"
              aria-label={copy.ribbon.close}
              onClick={() => setOpenMoment(null)}
            >
              ✕
            </button>
          </div>
          <p className="mt-1 border-l-2 border-tone-hostile pl-2 text-sm text-ink">
            {openMoment.quote}
          </p>
          <p className="mt-3 text-xs text-brand">{copy.ribbon.offered}</p>
          <p className="mt-1 border-l-2 border-brand pl-2 text-sm text-ink">{openMoment.rewrite}</p>
        </div>
      )}

      <div className="mx-auto max-w-md">
        <div className="mb-1 flex items-center justify-between text-[10px] text-ink-muted">
          <span>-10:00</span>
          <span>{copy.ribbon.now}</span>
        </div>
        <div className="relative">
          <svg
            viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
            preserveAspectRatio="none"
            className="h-8 w-full rounded-md bg-sunken"
            role="img"
            aria-label={copy.ribbon.label}
          >
            {segments.map((segment, i) => (
              <rect
                key={i}
                x={segment.x}
                y={0}
                width={Math.max(segment.width, 1)}
                height={VIEW_H}
                fill={LEVEL_FILL[segment.level]}
                fillOpacity={0.8}
              />
            ))}
          </svg>
          {visibleFlags.map((moment) => (
            <button
              key={moment.at}
              type="button"
              aria-label={`${copy.ribbon.flagged} ${formatClock(moment.at, startedAt)} — ${moment.quote.slice(0, 60)}`}
              aria-expanded={openMoment?.at === moment.at}
              onClick={() => setOpenMoment(openMoment?.at === moment.at ? null : moment)}
              className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-tone-hostile bg-raised shadow-e1 transition hover:scale-125"
              style={{ left: `${(((moment.at - start) / WINDOW_MS) * 100).toFixed(2)}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
