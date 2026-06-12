import type { ToneLabel } from '@/types/api'
import type { EmotionLevel, LlmToneResult, SpeedLevel, TranscriptEntry } from '@/types/app'
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

export type FusionMode = 'llm' | 'rules'

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

export function computeScore(
  volume: number,
  speedLevel: SpeedLevel,
  transcript: TranscriptEntry[],
  now: number,
  llmTone: LlmToneResult | null,
  llmAvailable: boolean,
): ScoreResult {
  const keywordResult = detectKeywords(transcript, now)
  const acousticScore = BASE_SCORE + getVolumeBonus(volume) + getSpeedBonus(speedLevel)

  // Freshness decays 1 -> 0 over LLM_FRESH_MS; while speaking, analyze
  // results land every ~4-6s so it stays near 1 in a live conversation.
  const freshness =
    llmAvailable && llmTone ? Math.max(0, 1 - (now - llmTone.at) / LLM_FRESH_MS) : 0

  let score: number
  let fusionMode: FusionMode

  if (llmTone && freshness > 0) {
    fusionMode = 'llm'
    const rulesScore = clampScore(
      acousticScore +
        keywordResult.highRiskKeywords.length * LLM_MODE_HIGH_RISK_WEIGHT +
        keywordResult.mediumRiskKeywords.length * LLM_MODE_MEDIUM_RISK_WEIGHT,
    )
    const semanticScore = clampScore(llmTone.intensity) * TONE_MULTIPLIER[llmTone.tone]
    const llmWeight = LLM_MAX_WEIGHT * freshness
    score = clampScore(Math.round((1 - llmWeight) * rulesScore + llmWeight * semanticScore))

    if (
      llmTone.tone === 'aggressive' &&
      llmTone.intensity >= SEMANTIC_FLOOR_MIN_INTENSITY &&
      now - llmTone.at <= SEMANTIC_FLOOR_FRESH_MS
    ) {
      score = Math.max(score, SEMANTIC_FLOOR_SCORE)
    }
  } else {
    // Degraded mode: exactly the original rules-only formula.
    fusionMode = 'rules'
    score = clampScore(
      acousticScore +
        keywordResult.highRiskKeywords.length * LEGACY_HIGH_RISK_WEIGHT +
        keywordResult.mediumRiskKeywords.length * LEGACY_MEDIUM_RISK_WEIGHT,
    )
  }

  const emotionLevel = getEmotionLevel(score)
  const meta = EMOTION_META[emotionLevel]

  return {
    score,
    emotionLevel,
    emotionColor: meta.color,
    emotionLabel: meta.label,
    highRiskKeywords: keywordResult.highRiskKeywords,
    mediumRiskKeywords: keywordResult.mediumRiskKeywords,
    fusionMode,
  }
}
