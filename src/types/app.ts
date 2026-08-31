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

/** Whether the tick had a live semantic read, or fell back to local rules. */
export type FusionMode = 'llm' | 'rules'

/** What the microphone heard: loudness and pace, no judgement attached. */
export interface AcousticSignal {
  /** Mic RMS 0-100 sampled at the tick. */
  volume: number
  volumeBonus: number
  speedLevel: SpeedLevel
  speedBonus: number
  /** BASE_SCORE + volumeBonus + speedBonus. */
  score: number
}

/** What the words meant: the local lexicon plus the model's tone read. */
export interface SemanticSignal {
  tone: ToneLabel | null
  intensity: number
  /** 1 -> 0 as the model result ages out over LLM_FRESH_MS. */
  freshness: number
  /** Blend weight the model read carried this tick (0 in rules mode). */
  weight: number
  /** Tone-weighted intensity 0-100; null when no usable model read. */
  score: number | null
  highRiskKeywords: string[]
  mediumRiskKeywords: string[]
  keywordBonus: number
  /** The semantic floor lifted a quiet-but-hostile tick into the trigger band. */
  floorApplied: boolean
}

/**
 * Per-tick provenance of the fused score, kept so the UI can show WHY a
 * reminder fired instead of only that it did. Acoustic and semantic stay
 * separate all the way to the screen.
 */
export interface SignalBreakdown {
  at: number
  mode: FusionMode
  acoustic: AcousticSignal
  semantic: SemanticSignal
}

export interface EmotionHistoryEntry {
  timestamp: number
  score: number
  emotionLevel: EmotionLevel
  /** Absent on ticks dispatched without provenance (tests, older demo steps). */
  signals?: SignalBreakdown
}
