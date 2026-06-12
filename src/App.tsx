import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CalmReminder } from './components/CalmReminder'
import { ToneSuggestion } from './components/ToneSuggestion'
import { useAudioAnalyser } from './hooks/useAudioAnalyser'
import { useEmotionDetector } from './hooks/useEmotionDetector'
import { useGroqTranscriber } from './hooks/useGroqTranscriber'
import { useRewriteSuggestion } from './hooks/useRewriteSuggestion'
import { useSpeechRate } from './hooks/useSpeechRate'
import { useSpeechRecognition } from './hooks/useSpeechRecognition'
import { useToneAnalysis } from './hooks/useToneAnalysis'
import { useTranscriptStream } from './hooks/useTranscriptStream'
import { useLiveSessionT } from './features/live-session/i18n'
import { useLocale } from './shared/i18n/localeContext'
import type {
  AppLanguage,
  EmotionHistoryEntry,
  EmotionLevel,
  TranscriptEntry,
} from './types/app'

const TIMELINE_WINDOW_MS = 5 * 60_000


const EMOTION_EMOJI: Record<EmotionLevel, string> = {
  calm: '🟢',
  elevated: '🟡',
  heated: '🟠',
  critical: '🔴',
}

const EMOTION_DOT_CLASS: Record<EmotionLevel, string> = {
  calm: 'bg-emerald-400',
  elevated: 'bg-yellow-300',
  heated: 'bg-orange-400',
  critical: 'bg-red-500',
}

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

const getTrend = (history: EmotionHistoryEntry[]) => {
  if (history.length < 2) {
    return 'flat' as const
  }

  const sample = history.slice(-4)
  const diff = sample[sample.length - 1].score - sample[0].score

  if (diff > 5) return 'up' as const
  if (diff < -5) return 'down' as const
  return 'flat' as const
}

const getEmotionAtTimestamp = (
  timestamp: number,
  history: EmotionHistoryEntry[],
  fallback: EmotionLevel,
): EmotionLevel => {
  if (history.length === 0) {
    return fallback
  }

  for (let i = history.length - 1; i >= 0; i -= 1) {
    if (history[i].timestamp <= timestamp) {
      return history[i].emotionLevel
    }
  }

  return history[0].emotionLevel
}

interface TimelineProps {
  history: EmotionHistoryEntry[]
  language: AppLanguage
  emptyLabel: string
  now: number
}

function EmotionTimeline({ history, language, emptyLabel, now }: TimelineProps) {
  const start = now - TIMELINE_WINDOW_MS
  const recent = history.filter((item) => item.timestamp >= start)

  if (recent.length < 2) {
    return (
      <div className="rounded-2xl border border-slate-700/80 bg-slate-900/70 p-4 text-sm text-slate-400">
        {emptyLabel}
      </div>
    )
  }

  const width = 320
  const height = 168
  const padding = 16
  const chartWidth = width - padding * 2
  const chartHeight = height - padding * 2

  const scoreToY = (score: number) => {
    return padding + (1 - score / 100) * chartHeight
  }

  const points = recent.map((item) => {
    const ratio = (item.timestamp - start) / TIMELINE_WINDOW_MS
    const x = padding + Math.min(1, Math.max(0, ratio)) * chartWidth
    const y = scoreToY(item.score)
    return { x, y, score: item.score }
  })

  const path = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)},${point.y.toFixed(2)}`)
    .join(' ')

  const latest = points[points.length - 1]
  const timeLabels = language === 'zh-CN' ? ['5分钟前', '现在'] : ['5m ago', 'now']

  return (
    <div className="rounded-2xl border border-slate-700/80 bg-slate-900/70 p-3 shadow-lg">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-44 w-full">
        <rect
          x={padding}
          y={scoreToY(30)}
          width={chartWidth}
          height={scoreToY(0) - scoreToY(30)}
          fill="rgba(16,185,129,0.12)"
        />
        <rect
          x={padding}
          y={scoreToY(55)}
          width={chartWidth}
          height={scoreToY(31) - scoreToY(55)}
          fill="rgba(250,204,21,0.12)"
        />
        <rect
          x={padding}
          y={scoreToY(75)}
          width={chartWidth}
          height={scoreToY(56) - scoreToY(75)}
          fill="rgba(249,115,22,0.12)"
        />
        <rect
          x={padding}
          y={scoreToY(100)}
          width={chartWidth}
          height={scoreToY(76) - scoreToY(100)}
          fill="rgba(239,68,68,0.14)"
        />

        <line
          x1={padding}
          y1={scoreToY(50)}
          x2={padding + chartWidth}
          y2={scoreToY(50)}
          stroke="rgba(148,163,184,0.25)"
          strokeDasharray="3 4"
        />

        <path d={path} fill="none" stroke="#10B981" strokeWidth="3" strokeLinecap="round" />
        <circle cx={latest.x} cy={latest.y} r="4.2" fill="#10B981" />
      </svg>

      <div className="mt-1 flex items-center justify-between px-1 text-xs text-slate-400">
        <span>{timeLabels[0]}</span>
        <span>{timeLabels[1]}</span>
      </div>
    </div>
  )
}

function App() {
  const [isMonitoring, setIsMonitoring] = useState(false)
  const [sessionStartedAt, setSessionStartedAt] = useState<number | null>(null)
  const [nowTick, setNowTick] = useState(() => Date.now())
  const { locale: language, setLocale } = useLocale()

  const transcriptContainerRef = useRef<HTMLDivElement | null>(null)

  const copy = useLiveSessionT()

  const audio = useAudioAnalyser()
  const stream = useTranscriptStream()
  const speech = useSpeechRecognition({
    language,
    onFinalEntries: stream.addFinal,
    onInterim: stream.setInterim,
  })
  const transcriber = useGroqTranscriber({
    mediaStream: audio.mediaStream,
    volume: audio.volume,
    isActive: isMonitoring,
    language,
    onFinalEntries: stream.addFinal,
  })

  const { wordsPerMinute, speedLevel } = useSpeechRate(stream.entries, language)
  const toneAnalysis = useToneAnalysis({
    entries: stream.entries,
    language,
    isActive: isMonitoring,
  })
  const emotion = useEmotionDetector({
    volume: audio.volume,
    speedLevel,
    transcript: stream.entries,
    isActive: isMonitoring,
    llmTone: toneAnalysis.latest,
    llmAvailable: toneAnalysis.available,
  })
  const resetEmotion = emotion.reset
  const rewrite = useRewriteSuggestion({
    score: emotion.score,
    latestHighRiskKeyword: emotion.latestHighRiskKeyword,
    entries: stream.entries,
    language,
    isActive: isMonitoring,
  })

  // Groq STT only needs mic + MediaRecorder; Web Speech is an optional fallback.
  const isBrowserSupported = audio.isSupported
  const sttUnavailable =
    isMonitoring && transcriber.engine === 'browser' && !speech.isSupported
  const trend = getTrend(emotion.history)

  // When the Groq pipeline degrades, run the Web Speech fallback; stop it
  // again once a recovery probe brings the Groq engine back.
  const speechStart = speech.start
  const speechStop = speech.stop
  useEffect(() => {
    if (!isMonitoring || transcriber.engine !== 'browser' || !speech.isSupported) {
      return
    }
    speechStart()
    return () => {
      speechStop()
    }
  }, [isMonitoring, speech.isSupported, speechStart, speechStop, transcriber.engine])

  const trendIcon = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'
  const trendLabel = copy.trend[trend]

  const ringProgress = useMemo(() => {
    const radius = 86
    const circumference = 2 * Math.PI * radius
    const strokeOffset = circumference * (1 - emotion.score / 100)
    return { radius, circumference, strokeOffset }
  }, [emotion.score])

  const permissionDenied =
    audio.error === 'MIC_PERMISSION_DENIED' || speech.error === 'SPEECH_PERMISSION_DENIED'
  const elapsedSeconds =
    isMonitoring && sessionStartedAt ? Math.max(0, Math.floor((nowTick - sessionStartedAt) / 1000)) : 0

  const toggleMonitoring = useCallback(async () => {
    if (isMonitoring) {
      setIsMonitoring(false)
      setSessionStartedAt(null)
      audio.stopListening()
      return
    }

    if (!isBrowserSupported) {
      return
    }

    audio.clearError()
    speech.clearError()
    stream.clear()
    resetEmotion()

    const audioReady = await audio.startListening()
    if (!audioReady) {
      audio.stopListening()
      setIsMonitoring(false)
      return
    }

    setSessionStartedAt(Date.now())
    setIsMonitoring(true)
  }, [audio, isBrowserSupported, isMonitoring, resetEmotion, speech, stream])

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setNowTick(Date.now())
    }, 1000)

    return () => {
      window.clearInterval(timerId)
    }
  }, [])

  useEffect(() => {
    if (!transcriptContainerRef.current) {
      return
    }

    transcriptContainerRef.current.scrollTop = transcriptContainerRef.current.scrollHeight
  }, [stream.interim, stream.entries])

  const transcriptWithEmotion = useMemo(() => {
    return stream.entries.map((entry) => {
      const level = getEmotionAtTimestamp(entry.timestamp, emotion.history, emotion.emotionLevel)
      return {
        ...entry,
        emotionLevel: level,
      }
    })
  }, [emotion.emotionLevel, emotion.history, stream.entries])

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <div className="mx-auto w-full max-w-md px-4 pb-24 pt-6">
        <header className="mb-5 rounded-3xl border border-slate-700/70 bg-slate-900/70 p-5 shadow-xl backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-3xl font-black tracking-tight text-emerald-300">ToneDown</h1>
              <p className="mt-1 text-sm font-medium text-slate-300">{copy.subtitle}</p>
            </div>
            <div className="rounded-full border border-slate-600 bg-slate-800/80 p-1">
              <button
                type="button"
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  language === 'zh-CN'
                    ? 'bg-emerald-500 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
                onClick={() => setLocale('zh-CN')}
              >
                中
              </button>
              <button
                type="button"
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  language === 'en-US'
                    ? 'bg-emerald-500 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
                onClick={() => setLocale('en-US')}
              >
                EN
              </button>
            </div>
          </div>
          <p className="mt-3 text-sm text-slate-300">{copy.intro}</p>
        </header>

        {!isBrowserSupported && (
          <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            {copy.notSupported}
          </div>
        )}

        {permissionDenied && (
          <div className="mb-4 rounded-2xl border border-orange-500/30 bg-orange-500/10 p-4 text-sm text-orange-100">
            {copy.permissionDenied}
          </div>
        )}

        {sttUnavailable && (
          <div className="mb-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
            {copy.sttUnavailable}
          </div>
        )}

        <section className="mb-5 rounded-3xl border border-slate-700/70 bg-slate-900/70 p-5 shadow-lg">
          <div className="mb-3 text-center text-sm text-slate-400">
            {isMonitoring ? `${copy.listeningTime}: ${formatDuration(elapsedSeconds)}` : ''}
          </div>
          <div className="flex justify-center">
            <button
              type="button"
              className={`flex h-36 w-36 items-center justify-center rounded-full text-base font-bold text-slate-950 shadow-xl transition-transform active:scale-95 ${
                isMonitoring
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'bg-emerald-500 hover:bg-emerald-400'
              }`}
              onClick={() => {
                void toggleMonitoring()
              }}
              disabled={!isBrowserSupported}
            >
              {isMonitoring ? copy.stop : copy.start}
            </button>
          </div>
        </section>

        <section className="mb-5 rounded-3xl border border-slate-700/70 bg-slate-900/70 p-5 shadow-lg">
          <p className="mb-4 text-sm font-medium text-slate-300">{copy.dashboard}</p>

          <div className="relative mx-auto flex h-56 w-56 items-center justify-center">
            <svg className="h-full w-full -rotate-90" viewBox="0 0 220 220">
              <circle
                cx="110"
                cy="110"
                r={ringProgress.radius}
                stroke="rgba(100,116,139,0.3)"
                strokeWidth="16"
                fill="none"
              />
              <circle
                cx="110"
                cy="110"
                r={ringProgress.radius}
                stroke={emotion.emotionColor}
                strokeWidth="16"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={ringProgress.circumference}
                strokeDashoffset={ringProgress.strokeOffset}
                style={{ transition: 'stroke-dashoffset 0.5s ease, stroke 0.5s ease' }}
              />
            </svg>

            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-3xl font-black text-slate-100">{emotion.score}</p>
              <p className="mt-1 text-xl">{EMOTION_EMOJI[emotion.emotionLevel]}</p>
              <p className="mt-1 text-sm font-semibold uppercase tracking-wide text-slate-300">
                {emotion.emotionLabel}
              </p>
            </div>
          </div>

          <p className="mt-2 text-center text-sm text-slate-300">{copy.emotionState[emotion.emotionLevel]}</p>

          {isMonitoring && emotion.fusionMode === 'llm' && toneAnalysis.latest && (
            <p className="mt-1 text-center text-xs text-slate-400">
              <span className="font-semibold text-violet-300">{toneAnalysis.latest.tone}</span>
              {toneAnalysis.latest.rationale ? ` · ${toneAnalysis.latest.rationale}` : ''}
            </p>
          )}

          <div className="mt-5 grid grid-cols-3 gap-2">
            <MetricCard label={copy.metrics.volume} value={`🔊 ${audio.volume}%`} />
            <MetricCard
              label={copy.metrics.speed}
              value={`🗣️ ${wordsPerMinute} ${copy.speedUnit}`}
              description={copy.speedLabel[speedLevel]}
            />
            <MetricCard label={copy.metrics.trend} value={`📊 ${trendIcon}`} description={trendLabel} />
          </div>
        </section>

        <section className="mb-5 rounded-3xl border border-slate-700/70 bg-slate-900/70 p-5 shadow-lg">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium text-slate-300">{copy.transcript}</p>
            {isMonitoring && (
              <span className="flex items-center gap-1.5">
                {!toneAnalysis.available && (
                  <span className="rounded-full border border-slate-500/50 bg-slate-700/40 px-2 py-0.5 text-xs font-semibold text-slate-300">
                    {copy.rulesMode}
                  </span>
                )}
                <span
                  className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${
                    transcriber.engine === 'groq'
                      ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200'
                      : 'border-amber-400/40 bg-amber-500/10 text-amber-200'
                  }`}
                >
                  {transcriber.engine === 'groq' ? copy.engineGroq : copy.engineBrowser}
                </span>
              </span>
            )}
          </div>

          <div
            ref={transcriptContainerRef}
            className="max-h-56 min-h-40 overflow-y-auto rounded-2xl border border-slate-700 bg-slate-950/60 p-3"
          >
            {transcriptWithEmotion.length === 0 && !stream.interim && (
              <p className="text-sm text-slate-500">{copy.emptyTranscript}</p>
            )}

            <div className="space-y-3">
              {transcriptWithEmotion.map((entry) => (
                <TranscriptItem key={entry.timestamp} entry={entry} />
              ))}

              {stream.interim && (
                <div className="flex items-start gap-2 text-sm italic text-slate-400">
                  <span className="mt-1 block h-2 w-2 rounded-full bg-slate-500" />
                  <p>
                    {copy.interim}: {stream.interim}
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="mb-5 rounded-3xl border border-slate-700/70 bg-slate-900/70 p-5 shadow-lg">
          <p className="mb-3 text-sm font-medium text-slate-300">{copy.toneSuggestion}</p>
          {emotion.highRiskKeywords.length > 0 ? (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3">
              <p className="text-xs text-red-200">{copy.toneSuggestionDetected}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {emotion.highRiskKeywords.map((keyword) => (
                  <span
                    key={keyword}
                    className="rounded-full border border-red-400/40 bg-red-500/10 px-2 py-1 text-xs text-red-100"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <p className="rounded-2xl border border-slate-700 bg-slate-950/50 p-3 text-sm text-slate-400">
              {copy.toneSuggestionEmpty}
            </p>
          )}
          <p className="mt-3 text-xs text-slate-400">{copy.toneSuggestionHint}</p>
        </section>

        <section className="mb-5">
          <p className="mb-3 text-sm font-medium text-slate-300">{copy.timeline}</p>
          <EmotionTimeline
            history={emotion.history}
            language={language}
            emptyLabel={copy.timelineEmpty}
            now={nowTick}
          />
        </section>

        <footer className="px-2 text-center text-xs text-slate-500">{copy.disclaimer}</footer>
      </div>

      <ToneSuggestion
        triggerKeyword={isMonitoring ? emotion.latestHighRiskKeyword : null}
        llmSuggestion={rewrite.suggestion}
      />
      <CalmReminder score={emotion.score} isActive={isMonitoring} />
    </div>
  )
}

interface MetricCardProps {
  label: string
  value: string
  description?: string
}

function MetricCard({ label, value, description }: MetricCardProps) {
  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-950/60 p-3">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-100">{value}</p>
      {description ? <p className="mt-1 text-xs text-slate-400">{description}</p> : null}
    </div>
  )
}

interface TranscriptItemProps {
  entry: TranscriptEntry & { emotionLevel: EmotionLevel }
}

function TranscriptItem({ entry }: TranscriptItemProps) {
  return (
    <div className="flex items-start gap-2 text-sm text-slate-200">
      <span className={`mt-1 block h-2.5 w-2.5 rounded-full ${EMOTION_DOT_CLASS[entry.emotionLevel]}`} />
      <p>{entry.text}</p>
    </div>
  )
}

export default App
