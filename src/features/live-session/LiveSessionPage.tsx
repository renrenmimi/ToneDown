import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ToneSuggestion } from './components/ToneSuggestion'
import { useLiveSessionT } from './i18n'
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
} from './machine/selectors'
import { fusionSignal, sessionStore, volumeSignal } from './machine/sessionStore'
import { SessionServices } from './services/SessionServices'
import { useRecapPersistence } from '@/features/recap/useRecapPersistence'
import { RecapView } from '@/features/recap/RecapView'
import { isAudioAnalyserSupported } from './services/useAudioAnalyser'
import { useRewriteSuggestion } from './services/useRewriteSuggestion'
import { isSpeechRecognitionSupported } from './services/useSpeechRecognition'
import { useSignalValue } from '@/shared/state/signalBus'
import { useLocale } from '@/shared/i18n/localeContext'
import { BreathingGuide } from './components/BreathingGuide'
import { SessionRibbon } from './components/SessionRibbon'
import { ToneGauge } from './components/ToneGauge'
import { Link } from 'wouter'
import { Aurora } from '@/shared/ui/Aurora'
import { ThemeToggle } from '@/shared/ui/ThemeToggle'
import type {
  EmotionHistoryEntry,
  EmotionLevel,
  TranscriptEntry,
} from '@/types/app'


const EMOTION_DOT_CLASS: Record<EmotionLevel, string> = {
  calm: 'bg-tone-calm',
  elevated: 'bg-tone-tense',
  heated: 'bg-tone-heated',
  critical: 'bg-tone-hostile',
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

function LiveSessionPage() {
  const [nowTick, setNowTick] = useState(() => Date.now())
  const { locale: language, setLocale } = useLocale()

  const transcriptContainerRef = useRef<HTMLDivElement | null>(null)

  const copy = useLiveSessionT()
  useRecapPersistence()

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

  // Middle-ring normalization: a brisk argument pegs ~100.
  const rateValue = Math.min(
    100,
    Math.round(frame.wordsPerMinute / (language === 'zh-CN' ? 3.5 : 2.4)),
  )
  const llmFresh =
    frame.llmTone !== null && frame.fusionMode === 'llm' ? frame.llmTone.intensity : 0

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
    <div className="min-h-screen text-ink">
      <Aurora />
      <div className="mx-auto w-full max-w-md px-4 pb-24 pt-6">
        <header className="mb-5 rounded-sheet border border-line bg-raised/80 p-5 shadow-e2 backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="font-display text-3xl font-bold tracking-tight text-brand">ToneDown</h1>
              <p className="mt-1 text-sm font-medium text-ink-secondary">{copy.subtitle}</p>
            </div>
            <div className="flex items-center gap-2">
            <Link
              href="/gym"
              aria-label={copy.gymLink}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-raised text-sm shadow-e1 transition hover:brightness-110"
            >
              🏋️
            </Link>
            <Link
              href="/spar"
              aria-label={copy.sparringLink}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-raised text-sm shadow-e1 transition hover:brightness-110"
            >
              🥊
            </Link>
            <Link
              href="/history"
              aria-label={copy.historyLink}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-raised text-sm shadow-e1 transition hover:brightness-110"
            >
              📈
            </Link>
            <ThemeToggle ariaLabel={copy.themeToggle} />
            <div className="rounded-full border border-line-strong bg-sunken/80 p-1">
              <button
                type="button"
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  language === 'zh-CN'
                    ? 'bg-brand text-surface'
                    : 'text-ink-secondary hover:text-ink'
                }`}
                onClick={() => setLocale('zh-CN')}
                aria-pressed={language === 'zh-CN'}
              >
                中
              </button>
              <button
                type="button"
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  language === 'en-US'
                    ? 'bg-brand text-surface'
                    : 'text-ink-secondary hover:text-ink'
                }`}
                onClick={() => setLocale('en-US')}
                aria-pressed={language === 'en-US'}
              >
                EN
              </button>
            </div>
            </div>
          </div>
          <p className="mt-3 text-sm text-ink-secondary">{copy.intro}</p>
        </header>

        {!isBrowserSupported && (
          <div className="mb-4 rounded-card border border-accent/30 bg-accent/10 p-4 text-sm text-ink">
            {copy.notSupported}
          </div>
        )}

        {permissionDenied && (
          <div className="mb-4 rounded-card border border-accent/30 bg-accent/10 p-4 text-sm text-ink">
            {copy.permissionDenied}
          </div>
        )}

        {sttUnavailable && (
          <div className="mb-4 rounded-card border border-accent/30 bg-accent/10 p-4 text-sm text-ink">
            {copy.sttUnavailable}
          </div>
        )}

        {phase === 'recap' ? (
          <RecapView />
        ) : (
        <>
        <section className="mb-5 rounded-sheet border border-line bg-raised/80 p-5 shadow-e2 backdrop-blur">
          <div className="mb-3 text-center text-sm text-ink-muted">
            {isMonitoring ? `${copy.listeningTime}: ${formatDuration(elapsedSeconds)}` : ''}
          </div>
          <div className="flex justify-center">
            <button
              type="button"
              className={`flex h-36 w-36 items-center justify-center rounded-full text-base font-bold shadow-e3 transition-transform active:scale-95 ${
                isMonitoring
                  ? 'rm-static border border-line-strong bg-raised text-ink animate-pulse'
                  : 'bg-accent-fill text-on-accent hover:brightness-110'
              }`}
              onClick={toggleMonitoring}
              disabled={!isBrowserSupported}
            >
              {isMonitoring ? copy.stop : copy.start}
            </button>
          </div>
        </section>

        <section className="mb-5 rounded-sheet border border-line bg-raised/80 p-5 shadow-e2 backdrop-blur">
          <p className="mb-4 text-sm font-medium text-ink-secondary">{copy.dashboard}</p>

          {phase === 'intervention' ? (
            <BreathingGuide />
          ) : (
            <ToneGauge
              score={score}
              level={emotionLevel}
              rateValue={rateValue}
              semanticValue={llmFresh}
              trendIcon={trendIcon}
              trendLabel={trendLabel}
            />
          )}

          <p className="mt-2 text-center text-sm text-ink-secondary">{copy.emotionState[emotionLevel]}</p>

          {isMonitoring && frame.fusionMode === 'llm' && frame.llmTone && (
            <p className="mt-1 text-center text-xs text-ink-muted">
              <span className="font-semibold text-brand">{frame.llmTone.tone}</span>
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

        <section className="mb-5 rounded-sheet border border-line bg-raised/80 p-5 shadow-e2 backdrop-blur">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium text-ink-secondary">{copy.transcript}</p>
            {isMonitoring && (
              <span className="flex items-center gap-1.5" role="status">
                {engines.analysis === 'rules' && (
                  <span className="rounded-full border border-line-strong bg-sunken px-2 py-0.5 text-xs font-semibold text-ink-secondary">
                    {copy.rulesMode}
                  </span>
                )}
                <span
                  className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${
                    engines.stt === 'groq'
                      ? 'border-brand/40 bg-brand/10 text-brand'
                      : 'border-accent/40 bg-accent/10 text-accent'
                  }`}
                >
                  {engines.stt === 'groq' ? copy.engineGroq : copy.engineBrowser}
                </span>
              </span>
            )}
          </div>

          <div
            ref={transcriptContainerRef}
            role="log"
            className="max-h-56 min-h-40 overflow-y-auto rounded-card border border-line bg-sunken/60 p-3"
          >
            {transcriptWithEmotion.length === 0 && !interim && (
              <p className="text-sm text-ink-muted">{copy.emptyTranscript}</p>
            )}

            <div className="space-y-3">
              {transcriptWithEmotion.map((entry) => (
                <TranscriptItem key={entry.timestamp} entry={entry} />
              ))}

              {interim && (
                <div className="flex items-start gap-2 text-sm italic text-ink-muted">
                  <span className="mt-1 block h-2 w-2 rounded-full bg-ink-muted" />
                  <p>
                    {copy.interim}: {interim}
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="mb-5 rounded-sheet border border-line bg-raised/80 p-5 shadow-e2 backdrop-blur">
          <p className="mb-3 text-sm font-medium text-ink-secondary">{copy.toneSuggestion}</p>
          {frame.highRiskKeywords.length > 0 ? (
            <div className="rounded-card border border-tone-hostile/30 bg-tone-hostile/10 p-3">
              <p className="text-xs text-tone-hostile">{copy.toneSuggestionDetected}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {frame.highRiskKeywords.map((keyword) => (
                  <span
                    key={keyword}
                    className="rounded-full border border-tone-hostile/40 bg-tone-hostile/10 px-2 py-1 text-xs text-ink"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <p className="rounded-card border border-line bg-sunken/50 p-3 text-sm text-ink-muted">
              {copy.toneSuggestionEmpty}
            </p>
          )}
          <p className="mt-3 text-xs text-ink-muted">{copy.toneSuggestionHint}</p>
        </section>


        </>
        )}

        <footer className="px-2 text-center text-xs text-ink-muted">{copy.disclaimer}</footer>
      </div>

      <SessionRibbon />
      <SessionServices />
      <ToneSuggestion
        triggerKeyword={isMonitoring ? frame.latestHighRiskKeyword : null}
        llmSuggestion={rewrite.suggestion}
      />
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
    <div className="rounded-card border border-line bg-sunken/60 p-3">
      <p className="text-xs text-ink-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold tabular-nums text-ink">{value}</p>
      {description ? <p className="mt-1 text-xs text-ink-muted">{description}</p> : null}
    </div>
  )
}

interface TranscriptItemProps {
  entry: TranscriptEntry & { emotionLevel: EmotionLevel }
}

function TranscriptItem({ entry }: TranscriptItemProps) {
  return (
    <div className="flex items-start gap-2 text-sm text-ink">
      <span className={`mt-1 block h-2.5 w-2.5 rounded-full ${EMOTION_DOT_CLASS[entry.emotionLevel]}`} />
      <p>{entry.text}</p>
    </div>
  )
}

export default LiveSessionPage
