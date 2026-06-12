import type { ToneLabel } from './api'

export type AppLanguage = 'zh-CN' | 'en-US'

/** Semantic tone signal from /api/analyze, fused into the 2s emotion score. */
export interface LlmToneResult {
  tone: ToneLabel
  intensity: number
  rationale: string
  /** Epoch ms when the result landed; drives staleness decay in the fusion. */
  at: number
}

export type SttEngine = 'groq' | 'browser'

export interface TranscriptEntry {
  text: string
  timestamp: number
  source?: SttEngine
}

export type SpeedLevel = 'slow' | 'normal' | 'fast' | 'very_fast'

export type EmotionLevel = 'calm' | 'elevated' | 'heated' | 'critical'

export interface EmotionHistoryEntry {
  timestamp: number
  score: number
  emotionLevel: EmotionLevel
}
