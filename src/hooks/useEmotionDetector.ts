import { useCallback, useEffect, useRef, useState } from 'react'
import type { ToneLabel } from '../types/api'
import type {
  EmotionHistoryEntry,
  EmotionLevel,
  LlmToneResult,
  SpeedLevel,
  TranscriptEntry,
} from '../types/app'

const UPDATE_INTERVAL_MS = 2_000
const KEYWORD_WINDOW_MS = 30_000
const MAX_HISTORY_POINTS = 300
const BASE_SCORE = 30

// --- LLM fusion ---
// A fresh /api/analyze result is blended with the rules score; its weight
// decays linearly to zero over LLM_FRESH_MS so the acoustic/keyword signals
// take back over when the semantic signal goes stale (silence, API outage).
const LLM_FRESH_MS = 20_000
const LLM_MAX_WEIGHT = 0.6
const TONE_MULTIPLIER: Record<ToneLabel, number> = {
  aggressive: 1,
  'passive-aggressive': 0.85,
  defensive: 0.65,
  neutral: 0.2,
  positive: 0,
}
// With a live semantic signal the crude lexicon matters less; in degraded
// mode the legacy 15/8 weights apply unchanged.
const LLM_MODE_HIGH_RISK_WEIGHT = 8
const LLM_MODE_MEDIUM_RISK_WEIGHT = 4
const LEGACY_HIGH_RISK_WEIGHT = 15
const LEGACY_MEDIUM_RISK_WEIGHT = 8
// Semantic floor: quiet-but-aggressive speech must still be able to reach
// CalmReminder's sustained-hostility trigger (score >= 70 held 5s).
const SEMANTIC_FLOOR_MIN_INTENSITY = 70
const SEMANTIC_FLOOR_SCORE = 72
const SEMANTIC_FLOOR_FRESH_MS = 10_000

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
  /** Latest semantic tone from /api/analyze; null until the first result. */
  llmTone?: LlmToneResult | null
  /** False while the analyze endpoint is degraded: forces pure-rules scoring. */
  llmAvailable?: boolean
}

type FusionMode = 'llm' | 'rules'

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

interface ScoreResult {
  score: number
  emotionLevel: EmotionLevel
  emotionColor: string
  emotionLabel: EmotionLevel
  highRiskKeywords: string[]
  mediumRiskKeywords: string[]
  fusionMode: FusionMode
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

const clampScore = (value: number): number => Math.max(0, Math.min(100, value))

const computeScore = (
  volume: number,
  speedLevel: SpeedLevel,
  transcript: TranscriptEntry[],
  now: number,
  llmTone: LlmToneResult | null,
  llmAvailable: boolean,
): ScoreResult => {
  const keywordResult = detectKeywords(transcript, now)
  const acousticScore = BASE_SCORE + getVolumeBonus(volume) + getSpeedBonus(speedLevel)

  // Freshness decays 1 -> 0 over LLM_FRESH_MS; while speaking, analyze
  // results land every ~4-6s so it stays near 1 in a live conversation.
  const freshness =
    llmAvailable && llmTone ? Math.max(0, 1 - (now - llmTone.at) / LLM_FRESH_MS) : 0

  let score: number
  let fusionMode: FusionMode

  if (llmTone && freshness > 0) {
    fusionMode = 'llm'
    const rulesScore = clampScore(
      acousticScore +
        keywordResult.highRiskKeywords.length * LLM_MODE_HIGH_RISK_WEIGHT +
        keywordResult.mediumRiskKeywords.length * LLM_MODE_MEDIUM_RISK_WEIGHT,
    )
    const semanticScore = clampScore(llmTone.intensity) * TONE_MULTIPLIER[llmTone.tone]
    const llmWeight = LLM_MAX_WEIGHT * freshness
    score = clampScore(Math.round((1 - llmWeight) * rulesScore + llmWeight * semanticScore))

    if (
      llmTone.tone === 'aggressive' &&
      llmTone.intensity >= SEMANTIC_FLOOR_MIN_INTENSITY &&
      now - llmTone.at <= SEMANTIC_FLOOR_FRESH_MS
    ) {
      score = Math.max(score, SEMANTIC_FLOOR_SCORE)
    }
  } else {
    // Degraded mode: exactly the original rules-only formula.
    fusionMode = 'rules'
    score = clampScore(
      acousticScore +
        keywordResult.highRiskKeywords.length * LEGACY_HIGH_RISK_WEIGHT +
        keywordResult.mediumRiskKeywords.length * LEGACY_MEDIUM_RISK_WEIGHT,
    )
  }

  const emotionLevel = getEmotionLevel(score)
  const meta = EMOTION_META[emotionLevel]

  return {
    score,
    emotionLevel,
    emotionColor: meta.color,
    emotionLabel: meta.label,
    highRiskKeywords: keywordResult.highRiskKeywords,
    mediumRiskKeywords: keywordResult.mediumRiskKeywords,
    fusionMode,
  }
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
