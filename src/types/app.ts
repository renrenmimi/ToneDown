export type AppLanguage = 'zh-CN' | 'en-US'

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
