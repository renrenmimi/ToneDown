import type { ToneLabel } from '@/types/api'
import type {
  EmotionLevel,
  FusionMode,
  LlmToneResult,
  SignalBreakdown,
  SpeedLevel,
  TranscriptEntry,
} from '@/types/app'
import { HIGH_RISK_EN, HIGH_RISK_ZH, MEDIUM_RISK_EN, MEDIUM_RISK_ZH } from './lexicon'

// Pure scoring math for the 2s fusion loop. No timers, no React, no IO —
// everything takes `now` explicitly so tests and demo mode are deterministic.

export const BASE_SCORE = 30
export const KEYWORD_WINDOW_MS = 30_000

// --- LLM fusion ---
// A fresh /api/analyze result is blended with the rules score; its weight
// decays linearly to zero over LLM_FRESH_MS so the acoustic/keyword signals
// take back over when the semantic signal goes stale (silence, API outage).
export const LLM_FRESH_MS = 20_000
export const LLM_MAX_WEIGHT = 0.6
export const TONE_MULTIPLIER: Record<ToneLabel, number> = {
  aggressive: 1,
  'passive-aggressive': 0.85,
  defensive: 0.65,
  neutral: 0.2,
  positive: 0,
}
// With a live semantic signal the crude lexicon matters less; in degraded
// mode the legacy 15/8 weights apply unchanged.
export const LLM_MODE_HIGH_RISK_WEIGHT = 8
export const LLM_MODE_MEDIUM_RISK_WEIGHT = 4
export const LEGACY_HIGH_RISK_WEIGHT = 15
export const LEGACY_MEDIUM_RISK_WEIGHT = 8
// Semantic floor: quiet-but-aggressive speech must still be able to reach
// the sustained-hostility intervention trigger (score >= 70 held 5s).
export const SEMANTIC_FLOOR_MIN_INTENSITY = 70
export const SEMANTIC_FLOOR_SCORE = 72
export const SEMANTIC_FLOOR_FRESH_MS = 10_000

/** Ceiling of the acoustic bonuses: the loudest, fastest tick possible. */
export const MAX_ACOUSTIC_BONUS = 55

interface EmotionMeta {
  color: string
  label: EmotionLevel
}

export const EMOTION_META: Record<EmotionLevel, EmotionMeta> = {
  calm: { color: '#10B981', label: 'calm' },
  elevated: { color: '#FACC15', label: 'elevated' },
  heated: { color: '#F97316', label: 'heated' },
  critical: { color: '#EF4444', label: 'critical' },
}

export interface ScoreResult {
  score: number
  emotionLevel: EmotionLevel
  emotionColor: string
  emotionLabel: EmotionLevel
  highRiskKeywords: string[]
  mediumRiskKeywords: string[]
  fusionMode: FusionMode
  /** Provenance of this exact score, for the explanation timeline. */
  signals: SignalBreakdown
}

const unique = (items: string[]): string[] => [...new Set(items)]

export const getVolumeBonus = (volume: number): number => {
  if (volume > 70) return 30
  if (volume > 50) return 20
  if (volume > 30) return 10
  return 0
}

export const getSpeedBonus = (speedLevel: SpeedLevel): number => {
  if (speedLevel === 'very_fast') return 25
  if (speedLevel === 'fast') return 15
  return 0
}

export const getEmotionLevel = (score: number): EmotionLevel => {
  if (score <= 30) return 'calm'
  if (score <= 55) return 'elevated'
  if (score <= 75) return 'heated'
  return 'critical'
}

export const clampScore = (value: number): number => Math.max(0, Math.min(100, value))

export function detectKeywords(transcript: TranscriptEntry[], now: number) {
  const cutoff = now - KEYWORD_WINDOW_MS
  const recent = transcript.filter((entry) => entry.timestamp >= cutoff)
  const recentTexts = recent.map((entry) => entry.text)
  const lowerCaseTexts = recentTexts.map((text) => text.toLowerCase())

  const highRiskZhMatches = HIGH_RISK_ZH.filter((keyword) =>
    recentTexts.some((text) => text.includes(keyword)),
  )
  const highRiskEnMatches = HIGH_RISK_EN.filter((keyword) =>
    lowerCaseTexts.some((text) => text.includes(keyword)),
  )

  const mediumRiskZhMatches = MEDIUM_RISK_ZH.filter((keyword) =>
    recentTexts.some((text) => text.includes(keyword)),
  )
  const mediumRiskEnMatches = MEDIUM_RISK_EN.filter((keyword) =>
    lowerCaseTexts.some((text) => text.includes(keyword)),
  )

  return {
    highRiskKeywords: unique([...highRiskZhMatches, ...highRiskEnMatches]),
    mediumRiskKeywords: unique([...mediumRiskZhMatches, ...mediumRiskEnMatches]),
  }
}

/**
 * Splits one tick into its two families of evidence — what the mic heard and
 * what the words meant — without deciding anything. `computeScore` blends
 * this; the explanation timeline renders it. Keeping one producer means the
 * chart can never drift from the number it is explaining.
 */
export function describeSignals(
  volume: number,
  speedLevel: SpeedLevel,
  transcript: TranscriptEntry[],
  now: number,
  llmTone: LlmToneResult | null,
  llmAvailable: boolean,
): SignalBreakdown {
  const { highRiskKeywords, mediumRiskKeywords } = detectKeywords(transcript, now)
  const volumeBonus = getVolumeBonus(volume)
  const speedBonus = getSpeedBonus(speedLevel)

  // Freshness decays 1 -> 0 over LLM_FRESH_MS; while speaking, analyze
  // results land every ~4-6s so it stays near 1 in a live conversation.
  const freshness =
    llmAvailable && llmTone ? Math.max(0, 1 - (now - llmTone.at) / LLM_FRESH_MS) : 0
  const live = llmTone !== null && freshness > 0

  const keywordBonus = live
    ? highRiskKeywords.length * LLM_MODE_HIGH_RISK_WEIGHT +
      mediumRiskKeywords.length * LLM_MODE_MEDIUM_RISK_WEIGHT
    : highRiskKeywords.length * LEGACY_HIGH_RISK_WEIGHT +
      mediumRiskKeywords.length * LEGACY_MEDIUM_RISK_WEIGHT

  return {
    at: now,
    mode: live ? 'llm' : 'rules',
    acoustic: {
      volume: Math.round(clampScore(volume)),
      volumeBonus,
      speedLevel,
      speedBonus,
      score: BASE_SCORE + volumeBonus + speedBonus,
    },
    semantic: {
      tone: live ? llmTone.tone : null,
      intensity: live ? llmTone.intensity : 0,
      freshness,
      weight: live ? LLM_MAX_WEIGHT * freshness : 0,
      score: live ? clampScore(llmTone.intensity) * TONE_MULTIPLIER[llmTone.tone] : null,
      highRiskKeywords,
      mediumRiskKeywords,
      keywordBonus,
      floorApplied: false,
    },
  }
}

/** Freshness at which the semantic floor stops applying (age <= 10s). */
const SEMANTIC_FLOOR_MIN_FRESHNESS = 1 - SEMANTIC_FLOOR_FRESH_MS / LLM_FRESH_MS

/**
 * The blend, and the only place it lives. Takes a breakdown and returns the
 * fused score — so the live loop, the demo script, and any test all agree by
 * construction rather than by keeping two formulas in sync.
 */
export function fuseScore(signals: SignalBreakdown): { score: number; floorApplied: boolean } {
  const { acoustic, semantic } = signals
  const rulesScore = clampScore(acoustic.score + semantic.keywordBonus)

  if (signals.mode !== 'llm' || semantic.score === null) {
    // Degraded mode: exactly the original rules-only formula.
    return { score: rulesScore, floorApplied: false }
  }

  const blended = clampScore(
    Math.round((1 - semantic.weight) * rulesScore + semantic.weight * semantic.score),
  )
  const floorApplied =
    semantic.tone === 'aggressive' &&
    semantic.intensity >= SEMANTIC_FLOOR_MIN_INTENSITY &&
    semantic.freshness >= SEMANTIC_FLOOR_MIN_FRESHNESS &&
    blended < SEMANTIC_FLOOR_SCORE

  return { score: floorApplied ? SEMANTIC_FLOOR_SCORE : blended, floorApplied }
}

export function computeScore(
  volume: number,
  speedLevel: SpeedLevel,
  transcript: TranscriptEntry[],
  now: number,
  llmTone: LlmToneResult | null,
  llmAvailable: boolean,
): ScoreResult {
  const signals = describeSignals(volume, speedLevel, transcript, now, llmTone, llmAvailable)
  const { score, floorApplied } = fuseScore(signals)

  const emotionLevel = getEmotionLevel(score)
  const meta = EMOTION_META[emotionLevel]

  return {
    score,
    emotionLevel,
    emotionColor: meta.color,
    emotionLabel: meta.label,
    highRiskKeywords: signals.semantic.highRiskKeywords,
    mediumRiskKeywords: signals.semantic.mediumRiskKeywords,
    fusionMode: signals.mode,
    signals: floorApplied
      ? { ...signals, semantic: { ...signals.semantic, floorApplied: true } }
      : signals,
  }
}
