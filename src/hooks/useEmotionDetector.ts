import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  EmotionHistoryEntry,
  EmotionLevel,
  SpeedLevel,
  TranscriptEntry,
} from '../types/app'

const UPDATE_INTERVAL_MS = 2_000
const KEYWORD_WINDOW_MS = 30_000
const MAX_HISTORY_POINTS = 300
const BASE_SCORE = 30

const HIGH_RISK_ZH = [
  '你总是',
  '你从来不',
  '你怎么又',
  '烦死了',
  '别说了',
  '你就不能',
  '我受够了',
  '离婚',
  '分手',
  '滚',
]

const HIGH_RISK_EN = [
  'you always',
  'you never',
  'shut up',
  "i'm done",
  'whatever',
  'leave me alone',
]

const MEDIUM_RISK_ZH = ['为什么', '我说了多少次', '你听我说', '不是这样的']

const MEDIUM_RISK_EN = ['you don\'t understand', 'listen to me', "that's not fair"]

interface EmotionMeta {
  color: string
  label: EmotionLevel
}

const EMOTION_META: Record<EmotionLevel, EmotionMeta> = {
  calm: { color: '#10B981', label: 'calm' },
  elevated: { color: '#FACC15', label: 'elevated' },
  heated: { color: '#F97316', label: 'heated' },
  critical: { color: '#EF4444', label: 'critical' },
}

interface UseEmotionDetectorArgs {
  volume: number
  speedLevel: SpeedLevel
  transcript: TranscriptEntry[]
  isActive: boolean
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
  reset: () => void
}

interface ScoreResult {
  score: number
  emotionLevel: EmotionLevel
  emotionColor: string
  emotionLabel: EmotionLevel
  highRiskKeywords: string[]
  mediumRiskKeywords: string[]
}

const unique = (items: string[]): string[] => [...new Set(items)]

const getVolumeBonus = (volume: number): number => {
  if (volume > 70) return 30
  if (volume > 50) return 20
  if (volume > 30) return 10
  return 0
}

const getSpeedBonus = (speedLevel: SpeedLevel): number => {
  if (speedLevel === 'very_fast') return 25
  if (speedLevel === 'fast') return 15
  return 0
}

const getEmotionLevel = (score: number): EmotionLevel => {
  if (score <= 30) return 'calm'
  if (score <= 55) return 'elevated'
  if (score <= 75) return 'heated'
  return 'critical'
}

const detectKeywords = (transcript: TranscriptEntry[], now: number) => {
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

const computeScore = (
  volume: number,
  speedLevel: SpeedLevel,
  transcript: TranscriptEntry[],
  now: number,
): ScoreResult => {
  const keywordResult = detectKeywords(transcript, now)

  let score = BASE_SCORE
  score += getVolumeBonus(volume)
  score += getSpeedBonus(speedLevel)
  score += keywordResult.highRiskKeywords.length * 15
  score += keywordResult.mediumRiskKeywords.length * 8
  score = Math.max(0, Math.min(100, score))

  const emotionLevel = getEmotionLevel(score)
  const meta = EMOTION_META[emotionLevel]

  return {
    score,
    emotionLevel,
    emotionColor: meta.color,
    emotionLabel: meta.label,
    highRiskKeywords: keywordResult.highRiskKeywords,
    mediumRiskKeywords: keywordResult.mediumRiskKeywords,
  }
}

export function useEmotionDetector({
  volume,
  speedLevel,
  transcript,
  isActive,
}: UseEmotionDetectorArgs): UseEmotionDetectorResult {
  const [emotionLevel, setEmotionLevel] = useState<EmotionLevel>('calm')
  const [emotionColor, setEmotionColor] = useState(EMOTION_META.calm.color)
  const [emotionLabel, setEmotionLabel] = useState<EmotionLevel>('calm')
  const [score, setScore] = useState(BASE_SCORE)
  const [history, setHistory] = useState<EmotionHistoryEntry[]>([])
  const [highRiskKeywords, setHighRiskKeywords] = useState<string[]>([])
  const [mediumRiskKeywords, setMediumRiskKeywords] = useState<string[]>([])
  const [latestHighRiskKeyword, setLatestHighRiskKeyword] = useState<string | null>(null)

  const volumeRef = useRef(volume)
  const speedLevelRef = useRef(speedLevel)
  const transcriptRef = useRef(transcript)

  useEffect(() => {
    volumeRef.current = volume
    speedLevelRef.current = speedLevel
    transcriptRef.current = transcript
  }, [speedLevel, transcript, volume])

  const reset = useCallback(() => {
    setEmotionLevel('calm')
    setEmotionColor(EMOTION_META.calm.color)
    setEmotionLabel('calm')
    setScore(BASE_SCORE)
    setHistory([])
    setHighRiskKeywords([])
    setMediumRiskKeywords([])
    setLatestHighRiskKeyword(null)
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
      )

      setEmotionLevel(result.emotionLevel)
      setEmotionColor(result.emotionColor)
      setEmotionLabel(result.emotionLabel)
      setScore(result.score)
      setHighRiskKeywords(result.highRiskKeywords)
      setMediumRiskKeywords(result.mediumRiskKeywords)
      setLatestHighRiskKeyword(result.highRiskKeywords[0] ?? null)

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
    reset,
  }
}
