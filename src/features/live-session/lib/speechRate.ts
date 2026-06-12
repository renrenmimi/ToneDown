import type { AppLanguage, SpeedLevel, TranscriptEntry } from '@/types/app'

// Pure speech-rate math over a sliding transcript window.

export const SPEECH_RATE_WINDOW_MS = 10_000

export const countChineseCharacters = (text: string): number => {
  const matches = text.match(/[一-鿿]/g)
  if (matches && matches.length > 0) {
    return matches.length
  }

  return text.replace(/\s+/g, '').length
}

export const countEnglishWords = (text: string): number => {
  const matches = text.match(/[A-Za-z0-9']+/g)
  return matches ? matches.length : 0
}

export const getSpeedLevel = (wpm: number, language: AppLanguage): SpeedLevel => {
  if (language === 'zh-CN') {
    if (wpm < 150) return 'slow'
    if (wpm <= 250) return 'normal'
    if (wpm <= 320) return 'fast'
    return 'very_fast'
  }

  if (wpm < 120) return 'slow'
  if (wpm <= 180) return 'normal'
  if (wpm <= 230) return 'fast'
  return 'very_fast'
}

export function computeWordsPerMinute(
  transcript: TranscriptEntry[],
  language: AppLanguage,
  now: number,
): number {
  const cutoff = now - SPEECH_RATE_WINDOW_MS
  const recent = transcript.filter((entry) => entry.timestamp >= cutoff)

  const count = recent.reduce((total, entry) => {
    if (language === 'zh-CN') {
      return total + countChineseCharacters(entry.text)
    }

    return total + countEnglishWords(entry.text)
  }, 0)

  return Math.round((count / SPEECH_RATE_WINDOW_MS) * 60_000)
}
