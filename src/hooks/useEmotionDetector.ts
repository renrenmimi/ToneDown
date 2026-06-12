import { useCallback, useEffect, useRef, useState } from 'react'
import {
  BASE_SCORE,
  computeScore,
  EMOTION_META,
  type FusionMode,
} from '@/features/live-session/lib/fusion'
import type {
  EmotionHistoryEntry,
  EmotionLevel,
  LlmToneResult,
  SpeedLevel,
  TranscriptEntry,
} from '../types/app'

const UPDATE_INTERVAL_MS = 2_000
const MAX_HISTORY_POINTS = 300

interface UseEmotionDetectorArgs {
  volume: number
  speedLevel: SpeedLevel
  transcript: TranscriptEntry[]
  isActive: boolean
  /** Latest semantic tone from /api/analyze; null until the first result. */
  llmTone?: LlmToneResult | null
  /** False while the analyze endpoint is degraded: forces pure-rules scoring. */
  llmAvailable?: boolean
}

interface UseEmotionDetectorResult {
  emotionLevel: EmotionLevel
  emotionColor: string
  emotionLabel: EmotionLevel
  score: number
  history: EmotionHistoryEntry[]
  highRiskKeywords: string[]
  mediumRiskKeywords: string[]
  latestHighRiskKeyword: string | null
  /** Which formula produced the current score. */
  fusionMode: FusionMode
  reset: () => void
}

export function useEmotionDetector({
  volume,
  speedLevel,
  transcript,
  isActive,
  llmTone = null,
  llmAvailable = false,
}: UseEmotionDetectorArgs): UseEmotionDetectorResult {
  const [emotionLevel, setEmotionLevel] = useState<EmotionLevel>('calm')
  const [emotionColor, setEmotionColor] = useState(EMOTION_META.calm.color)
  const [emotionLabel, setEmotionLabel] = useState<EmotionLevel>('calm')
  const [score, setScore] = useState(BASE_SCORE)
  const [history, setHistory] = useState<EmotionHistoryEntry[]>([])
  const [highRiskKeywords, setHighRiskKeywords] = useState<string[]>([])
  const [mediumRiskKeywords, setMediumRiskKeywords] = useState<string[]>([])
  const [latestHighRiskKeyword, setLatestHighRiskKeyword] = useState<string | null>(null)
  const [fusionMode, setFusionMode] = useState<FusionMode>('rules')

  const volumeRef = useRef(volume)
  const speedLevelRef = useRef(speedLevel)
  const transcriptRef = useRef(transcript)
  const llmToneRef = useRef(llmTone)
  const llmAvailableRef = useRef(llmAvailable)

  useEffect(() => {
    volumeRef.current = volume
    speedLevelRef.current = speedLevel
    transcriptRef.current = transcript
    llmToneRef.current = llmTone
    llmAvailableRef.current = llmAvailable
  }, [llmAvailable, llmTone, speedLevel, transcript, volume])

  const reset = useCallback(() => {
    setEmotionLevel('calm')
    setEmotionColor(EMOTION_META.calm.color)
    setEmotionLabel('calm')
    setScore(BASE_SCORE)
    setHistory([])
    setHighRiskKeywords([])
    setMediumRiskKeywords([])
    setLatestHighRiskKeyword(null)
    setFusionMode('rules')
  }, [])

  useEffect(() => {
    if (!isActive) {
      return
    }

    const timerId = window.setInterval(() => {
      const now = Date.now()
      const result = computeScore(
        volumeRef.current,
        speedLevelRef.current,
        transcriptRef.current,
        now,
        llmToneRef.current,
        llmAvailableRef.current,
      )

      setEmotionLevel(result.emotionLevel)
      setEmotionColor(result.emotionColor)
      setEmotionLabel(result.emotionLabel)
      setScore(result.score)
      setHighRiskKeywords(result.highRiskKeywords)
      setMediumRiskKeywords(result.mediumRiskKeywords)
      setLatestHighRiskKeyword(result.highRiskKeywords[0] ?? null)
      setFusionMode(result.fusionMode)

      setHistory((prev) => {
        const next = [
          ...prev,
          {
            timestamp: now,
            score: result.score,
            emotionLevel: result.emotionLevel,
          },
        ]

        if (next.length > MAX_HISTORY_POINTS) {
          return next.slice(next.length - MAX_HISTORY_POINTS)
        }

        return next
      })
    }, UPDATE_INTERVAL_MS)

    return () => {
      window.clearInterval(timerId)
    }
  }, [isActive])

  return {
    emotionLevel,
    emotionColor,
    emotionLabel,
    score,
    history,
    highRiskKeywords,
    mediumRiskKeywords,
    latestHighRiskKeyword,
    fusionMode,
    reset,
  }
}
