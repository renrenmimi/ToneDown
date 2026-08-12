import type { SessionRecord } from '@/shared/storage/records'

// History is framed as progress: everything renders in the teal calm scale —
// this surface never shows crimson.

// Step 0 is the "no data" swatch — heatColor never reaches it for a real
// score, the null branch below covers that case instead.
// Step 3 was #168a7d, which failed WCAG AA against BOTH inks (3.84 / 3.85);
// darkened one notch along the same hue so the light ink clears 4.5.
const HEAT_STEPS = ['#16263c', '#14333a', '#14524f', '#147b6f', '#3ccfbc']

const HEAT_INK_LIGHT = '#eaf7f4'
const HEAT_INK_DARK = '#06251f'
/** Index at/above which the swatch is light enough for dark ink. */
const DARK_INK_FROM_STEP = 4

function heatStep(calmScore: number): number {
  return Math.min(4, Math.max(0, Math.floor(calmScore / 25) + 1))
}

export function heatColor(calmScore: number | null): string {
  if (calmScore === null) {
    return 'var(--surface-sunken)'
  }
  return HEAT_STEPS[heatStep(calmScore)]
}

/**
 * Readable ink for text sitting ON heatColor(score). The badge used to pin a
 * near-black ink across the whole scale, so the darkest swatches — the heated
 * sessions a user most wants to read — rendered at 1.2:1 and were effectively
 * invisible.
 */
export function heatInk(calmScore: number | null): string {
  if (calmScore === null) {
    return 'var(--text-primary)'
  }
  return heatStep(calmScore) >= DARK_INK_FROM_STEP ? HEAT_INK_DARK : HEAT_INK_LIGHT
}

export interface DayBucket {
  date: string
  calmScore: number
  sessions: number
}

export function bucketByDay(records: SessionRecord[]): Map<string, DayBucket> {
  const buckets = new Map<string, DayBucket>()
  for (const record of records) {
    const date = new Date(record.startedAt)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    const existing = buckets.get(key)
    if (existing) {
      existing.calmScore = Math.round(
        (existing.calmScore * existing.sessions + record.calmScore) / (existing.sessions + 1),
      )
      existing.sessions += 1
    } else {
      buckets.set(key, { date: key, calmScore: record.calmScore, sessions: 1 })
    }
  }
  return buckets
}
