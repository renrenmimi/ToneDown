import type { DebriefResponse } from '@/types/api'
import type { AppLanguage } from '@/types/app'

// Stored records are JSON-blob-heavy on purpose: only ids/timestamps are
// indexed, so most schema evolution stays type-level instead of becoming
// IndexedDB migrations.

export interface StoredFlaggedMoment {
  /** Offset from session start, ms. */
  atMs: number
  quote: string
  rewrite: string
}

export interface SessionRecord {
  id?: number
  startedAt: number
  endedAt: number
  durationMs: number
  language: AppLanguage
  /** 100 - mean fused score: higher = calmer session. */
  calmScore: number
  peakScore: number
  interventionCount: number
  /** [offsetMs, score] pairs, downsampled to <= 200 points. */
  scoreSeries: [number, number][]
  flaggedMoments: StoredFlaggedMoment[]
  debrief: DebriefResponse | null
}

/** Sparring rounds land in M3; the table exists from schema v1. */
export interface SparringRoundRecord {
  id?: number
  endedAt: number
  personaId: string
  won: boolean
  payload: unknown
}

/** Tone Gym progress lands in M4; the table exists from schema v1. */
export interface DrillProgressRecord {
  id?: number
  date: string
  drillId: string
  bestScore: number
  cleared: boolean
  attempts: number
}

export interface GymGradeCacheRecord {
  /** hash(drillId + normalized attempt) */
  key: string
  score: number
  feedback: string
  betterVersion: string
  createdAt: number
}

export function downsampleSeries(
  series: [number, number][],
  maxPoints: number,
): [number, number][] {
  if (series.length <= maxPoints) {
    return series
  }
  const step = series.length / maxPoints
  const out: [number, number][] = []
  for (let i = 0; i < maxPoints; i += 1) {
    out.push(series[Math.floor(i * step)])
  }
  return out
}

export function computeCalmScore(scores: number[]): number {
  if (scores.length === 0) {
    return 100
  }
  const mean = scores.reduce((sum, s) => sum + s, 0) / scores.length
  return Math.min(100, Math.max(0, Math.round(100 - mean)))
}
