// Wire types shared between the client and the Vercel API routes.
// api/*.ts imports these type-only, so nothing from src/ ends up in the server bundle.

export type ToneLabel =
  | 'aggressive'
  | 'passive-aggressive'
  | 'defensive'
  | 'neutral'
  | 'positive'

export interface TranscribeResponse {
  transcript: string
  /**
   * Language detected by Whisper, normalized to ISO-639-1 for common languages
   * ('zh' | 'en' | ...); other languages may come through as lowercased names.
   * Empty if unknown.
   */
  language: string
}

export interface AnalyzeRequest {
  /** Latest finalized utterance to classify. */
  text: string
  /** Up to 10 prior utterances, oldest first, background context only. */
  context?: string[]
  language?: 'zh-CN' | 'en-US'
}

export interface AnalyzeResponse {
  tone: ToneLabel
  /** 0 (fully calm) .. 100 (explosive). */
  intensity: number
  /** One short sentence, same language as the utterance. */
  rationale: string
}

export interface RewriteRequest {
  /** 'rewrite' (default): constructive rephrasing; 'grounding': one calming line for the breathing guide. */
  kind?: 'rewrite' | 'grounding'
  /** The flagged hostile utterance to rephrase (grounding: recent context line). */
  utterance: string
  /** Up to 10 prior utterances, oldest first. */
  context?: string[]
  language?: 'zh-CN' | 'en-US'
}

export interface RewriteResponse {
  rewrite: string
}

export interface DebriefRequest {
  language: 'zh-CN' | 'en-US'
  durationMs: number
  /** Transcript thinned client-side: each entry with the fused score near its time. */
  entries: { text: string; score: number }[]
  /** Score timeline downsampled client-side: [offsetMs, score] pairs. */
  scoreSeries: [number, number][]
}

export interface DebriefTriggerMoment {
  quote: string
  why_it_escalated: string
  better_phrasing: string
}

export interface DebriefResponse {
  summary: string
  emotional_arc: string
  trigger_moments: DebriefTriggerMoment[]
  one_habit_to_practice: string
}

export interface ApiError {
  error: string
  /** Seconds until the rate limit window frees up (only on 429). */
  retryAfter?: number
}
