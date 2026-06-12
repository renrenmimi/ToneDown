import { useEffect, useMemo, useState } from 'react'
import type { AppLanguage, SpeedLevel, TranscriptEntry } from '../types/app'

const WINDOW_MS = 10_000
const TICK_MS = 1_000

interface UseSpeechRateResult {
  wordsPerMinute: number
  speedLevel: SpeedLevel
}

const countChineseCharacters = (text: string): number => {
  const matches = text.match(/[\u4e00-\u9fff]/g)
  if (matches && matches.length > 0) {
    return matches.length
  }

  return text.replace(/\s+/g, '').length
}

const countEnglishWords = (text: string): number => {
  const matches = text.match(/[A-Za-z0-9']+/g)
  return matches ? matches.length : 0
}

const getSpeedLevel = (wpm: number, language: AppLanguage): SpeedLevel => {
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

export function useSpeechRate(
  transcript: TranscriptEntry[],
  language: AppLanguage,
): UseSpeechRateResult {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setNow(Date.now())
    }, TICK_MS)

    return () => {
      window.clearInterval(timerId)
    }
  }, [])

  const wordsPerMinute = useMemo(() => {
    const cutoff = now - WINDOW_MS
    const recent = transcript.filter((entry) => entry.timestamp >= cutoff)

    const count = recent.reduce((total, entry) => {
      if (language === 'zh-CN') {
        return total + countChineseCharacters(entry.text)
      }

      return total + countEnglishWords(entry.text)
    }, 0)

    return Math.round((count / WINDOW_MS) * 60_000)
  }, [language, now, transcript])

  const speedLevel = useMemo(() => {
    return getSpeedLevel(wordsPerMinute, language)
  }, [language, wordsPerMinute])

  return {
    wordsPerMinute,
    speedLevel,
  }
}
