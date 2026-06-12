import type { SessionRecord } from '@/shared/storage/records'

// History is framed as progress: everything renders in the teal calm scale —
// this surface never shows crimson.

const HEAT_STEPS_DARK = ['#16263c', '#14333a', '#14524f', '#168a7d', '#3ccfbc']

export function heatColor(calmScore: number | null): string {
  if (calmScore === null) {
    return 'var(--surface-sunken)'
  }
  const idx = Math.min(4, Math.max(0, Math.floor(calmScore / 25) + 1))
  return HEAT_STEPS_DARK[idx]
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
