import { useEffect, useMemo, useState } from 'react'
import {
  computeWordsPerMinute,
  getSpeedLevel,
} from '@/features/live-session/lib/speechRate'
import type { AppLanguage, SpeedLevel, TranscriptEntry } from '../types/app'

const TICK_MS = 1_000

interface UseSpeechRateResult {
  wordsPerMinute: number
  speedLevel: SpeedLevel
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

  const wordsPerMinute = useMemo(
    () => computeWordsPerMinute(transcript, language, now),
    [language, now, transcript],
  )

  const speedLevel = useMemo(
    () => getSpeedLevel(wordsPerMinute, language),
    [language, wordsPerMinute],
  )

  return {
    wordsPerMinute,
    speedLevel,
  }
}
