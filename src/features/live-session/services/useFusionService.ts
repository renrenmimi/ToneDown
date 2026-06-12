import { useEffect, useRef } from 'react'
import { systemClock } from '@/shared/ports/clock'
import type { AppLanguage, LlmToneResult } from '@/types/app'
import { computeScore } from '../lib/fusion'
import { computeWordsPerMinute, getSpeedLevel } from '../lib/speechRate'
import { useIsSessionActive } from '../machine/selectors'
import { fusionSignal, initialFusionFrame, sessionStore, volumeSignal } from '../machine/sessionStore'

const FUSION_INTERVAL_MS = 2_000

interface UseFusionServiceArgs {
  llmTone: LlmToneResult | null
  llmAvailable: boolean
  language: AppLanguage
}

/**
 * The 2s fusion ticker: samples the volume signal + machine transcript,
 * runs the pure fusion math, publishes UI byproducts on fusionSignal, and
 * dispatches exactly one SCORE_UPDATED per tick. The machine never sees
 * the 100ms volume stream.
 */
export function useFusionService({ llmTone, llmAvailable, language }: UseFusionServiceArgs): void {
  const isActive = useIsSessionActive()

  const llmToneRef = useRef(llmTone)
  const llmAvailableRef = useRef(llmAvailable)
  const languageRef = useRef(language)

  useEffect(() => {
    llmToneRef.current = llmTone
    llmAvailableRef.current = llmAvailable
    languageRef.current = language
  }, [language, llmAvailable, llmTone])

  useEffect(() => {
    if (!isActive) {
      return
    }

    fusionSignal.set(initialFusionFrame)

    const stop = systemClock.setInterval(() => {
      const now = systemClock.now()
      const { transcript } = sessionStore.getState()
      const volume = volumeSignal.get()

      const wordsPerMinute = computeWordsPerMinute(transcript, languageRef.current, now)
      const speedLevel = getSpeedLevel(wordsPerMinute, languageRef.current)
      const result = computeScore(
        volume,
        speedLevel,
        transcript,
        now,
        llmToneRef.current,
        llmAvailableRef.current,
      )

      fusionSignal.set({
        wordsPerMinute,
        speedLevel,
        emotionColor: result.emotionColor,
        highRiskKeywords: result.highRiskKeywords,
        mediumRiskKeywords: result.mediumRiskKeywords,
        latestHighRiskKeyword: result.highRiskKeywords[0] ?? null,
        fusionMode: result.fusionMode,
        llmTone: llmToneRef.current,
      })

      sessionStore.dispatch({
        type: 'SCORE_UPDATED',
        score: result.score,
        level: result.emotionLevel,
        at: now,
      })
    }, FUSION_INTERVAL_MS)

    return stop
  }, [isActive])
}
