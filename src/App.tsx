import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CalmReminder } from './components/CalmReminder'
import { ToneSuggestion } from './components/ToneSuggestion'
import { useLiveSessionT } from './features/live-session/i18n'
import {
  useEngines,
  useInterim,
  useScoreHistory,
  useSession,
  useSessionError,
  useSessionPhase,
  useSessionScore,
  useEmotionLevel,
  useTranscript,
} from './features/live-session/machine/selectors'
import { fusionSignal, sessionStore, volumeSignal } from './features/live-session/machine/sessionStore'
import { SessionServices } from './features/live-session/services/SessionServices'
import { isAudioAnalyserSupported } from './hooks/useAudioAnalyser'
import { useRewriteSuggestion } from './hooks/useRewriteSuggestion'
import { isSpeechRecognitionSupported } from './hooks/useSpeechRecognition'
import { useSignalValue } from './shared/state/signalBus'
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
  const [nowTick, setNowTick] = useState(() => Date.now())
  const { locale: language, setLocale } = useLocale()

  const transcriptContainerRef = useRef<HTMLDivElement | null>(null)

  const copy = useLiveSessionT()

  // The session machine is the single source of truth; the UI reads slices.
  const phase = useSessionPhase()
  const score = useSessionScore()
  const emotionLevel = useEmotionLevel()
  const history = useScoreHistory()
  const transcript = useTranscript()
  const interim = useInterim()
  const engines = useEngines()
  const sessionError = useSessionError()
  const sessionStartedAt = useSession((s) => s.startedAt)
  const isMonitoring = phase !== 'idle' && phase !== 'recap'

  // Per-tick fusion byproducts + live mic level, off the signal bus.
  const frame = useSignalValue(fusionSignal)
  const volume = useSignalValue(volumeSignal)

  const rewrite = useRewriteSuggestion({
    score,
    latestHighRiskKeyword: frame.latestHighRiskKeyword,
    entries: transcript,
    language,
    isActive: isMonitoring,
  })

  // Groq STT only needs mic + MediaRecorder; Web Speech is an optional fallback.
  const isBrowserSupported = isAudioAnalyserSupported()
  const sttUnavailable =
    isMonitoring && engines.stt === 'browser' && !isSpeechRecognitionSupported()
  const trend = getTrend(history)

  const trendIcon = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'
  const trendLabel = copy.trend[trend]

  const ringProgress = useMemo(() => {
    const radius = 86
    const circumference = 2 * Math.PI * radius
    const strokeOffset = circumference * (1 - score / 100)
    return { radius, circumference, strokeOffset }
  }, [score])

  const permissionDenied = sessionError === 'MIC_PERMISSION_DENIED'
  const elapsedSeconds =
    isMonitoring && sessionStartedAt ? Math.max(0, Math.floor((nowTick - sessionStartedAt) / 1000)) : 0

  const toggleMonitoring = useCallback(() => {
    if (isMonitoring) {
      sessionStore.dispatch({ type: 'STOP_REQUESTED', at: Date.now() })
      return
    }
    if (!isBrowserSupported) {
      return
    }
    sessionStore.dispatch({ type: 'START_REQUESTED' })
  }, [isBrowserSupported, isMonitoring])

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
  }, [interim, transcript])

  const transcriptWithEmotion = useMemo(() => {
    return transcript.map((entry) => {
      const level = getEmotionAtTimestamp(entry.timestamp, history, emotionLevel)
      return {
        ...entry,
        emotionLevel: level,
      }
    })
  }, [emotionLevel, history, transcript])

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
              onClick={toggleMonitoring}
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
                stroke={frame.emotionColor}
                strokeWidth="16"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={ringProgress.circumference}
                strokeDashoffset={ringProgress.strokeOffset}
                style={{ transition: 'stroke-dashoffset 0.5s ease, stroke 0.5s ease' }}
              />
            </svg>

            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-3xl font-black text-slate-100">{score}</p>
              <p className="mt-1 text-xl">{EMOTION_EMOJI[emotionLevel]}</p>
              <p className="mt-1 text-sm font-semibold uppercase tracking-wide text-slate-300">
                {emotionLevel}
              </p>
            </div>
          </div>

          <p className="mt-2 text-center text-sm text-slate-300">{copy.emotionState[emotionLevel]}</p>

          {isMonitoring && frame.fusionMode === 'llm' && frame.llmTone && (
            <p className="mt-1 text-center text-xs text-slate-400">
              <span className="font-semibold text-violet-300">{frame.llmTone.tone}</span>
              {frame.llmTone.rationale ? ` · ${frame.llmTone.rationale}` : ''}
            </p>
          )}

          <div className="mt-5 grid grid-cols-3 gap-2">
            <MetricCard label={copy.metrics.volume} value={`🔊 ${volume}%`} />
            <MetricCard
              label={copy.metrics.speed}
              value={`🗣️ ${frame.wordsPerMinute} ${copy.speedUnit}`}
              description={copy.speedLabel[frame.speedLevel]}
            />
            <MetricCard label={copy.metrics.trend} value={`📊 ${trendIcon}`} description={trendLabel} />
          </div>
        </section>

        <section className="mb-5 rounded-3xl border border-slate-700/70 bg-slate-900/70 p-5 shadow-lg">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium text-slate-300">{copy.transcript}</p>
            {isMonitoring && (
              <span className="flex items-center gap-1.5">
                {engines.analysis === 'rules' && (
                  <span className="rounded-full border border-slate-500/50 bg-slate-700/40 px-2 py-0.5 text-xs font-semibold text-slate-300">
                    {copy.rulesMode}
                  </span>
                )}
                <span
                  className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${
                    engines.stt === 'groq'
                      ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200'
                      : 'border-amber-400/40 bg-amber-500/10 text-amber-200'
                  }`}
                >
                  {engines.stt === 'groq' ? copy.engineGroq : copy.engineBrowser}
                </span>
              </span>
            )}
          </div>

          <div
            ref={transcriptContainerRef}
            className="max-h-56 min-h-40 overflow-y-auto rounded-2xl border border-slate-700 bg-slate-950/60 p-3"
          >
            {transcriptWithEmotion.length === 0 && !interim && (
              <p className="text-sm text-slate-500">{copy.emptyTranscript}</p>
            )}

            <div className="space-y-3">
              {transcriptWithEmotion.map((entry) => (
                <TranscriptItem key={entry.timestamp} entry={entry} />
              ))}

              {interim && (
                <div className="flex items-start gap-2 text-sm italic text-slate-400">
                  <span className="mt-1 block h-2 w-2 rounded-full bg-slate-500" />
                  <p>
                    {copy.interim}: {interim}
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="mb-5 rounded-3xl border border-slate-700/70 bg-slate-900/70 p-5 shadow-lg">
          <p className="mb-3 text-sm font-medium text-slate-300">{copy.toneSuggestion}</p>
          {frame.highRiskKeywords.length > 0 ? (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3">
              <p className="text-xs text-red-200">{copy.toneSuggestionDetected}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {frame.highRiskKeywords.map((keyword) => (
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
            history={history}
            language={language}
            emptyLabel={copy.timelineEmpty}
            now={nowTick}
          />
        </section>

        <footer className="px-2 text-center text-xs text-slate-500">{copy.disclaimer}</footer>
      </div>

      <SessionServices />
      <ToneSuggestion
        triggerKeyword={isMonitoring ? frame.latestHighRiskKeyword : null}
        llmSuggestion={rewrite.suggestion}
      />
      <CalmReminder />
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
