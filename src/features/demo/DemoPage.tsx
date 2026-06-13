import { useEffect, useMemo, useState } from 'react'
import { Link } from 'wouter'
import { BreathingGuide } from '@/features/live-session/components/BreathingGuide'
import { SessionRibbon } from '@/features/live-session/components/SessionRibbon'
import { ToneGauge } from '@/features/live-session/components/ToneGauge'
import { ToneSuggestion } from '@/features/live-session/components/ToneSuggestion'
import { useLiveSessionT } from '@/features/live-session/i18n'
import {
  useEngines,
  useEmotionLevel,
  useInterim,
  useScoreHistory,
  useSessionPhase,
  useSessionScore,
  useTranscript,
} from '@/features/live-session/machine/selectors'
import {
  fusionSignal,
  initialFusionFrame,
  sessionStore,
  volumeSignal,
} from '@/features/live-session/machine/sessionStore'
import { createInitialSessionState } from '@/features/live-session/machine/sessionMachine'
import { RecapView } from '@/features/recap/RecapView'
import { recapSignal } from '@/features/recap/recapStore'
import { Aurora } from '@/shared/ui/Aurora'
import { ThemeToggle } from '@/shared/ui/ThemeToggle'
import { useSignalValue } from '@/shared/state/signalBus'
import { DEMO_DURATION_MS, DEMO_STEPS, volumeBaseAt, type DemoSink } from './script'
import { useDemoT } from './i18n'

// /demo: the full product in ~46s with zero mic, zero network, zero tokens.
// The script drives the REAL session machine and the same UI components as
// /app — only the inputs are canned. (LiveSessionPage's SessionServices is
// NOT mounted here, so no mic/LLM adapters exist at all.)

function useDemoPlayer() {
  const [progress, setProgress] = useState(0)
  const [runId, setRunId] = useState(0)
  const [suggestion, setSuggestion] = useState<{ original: string; rewrite: string } | null>(null)

  useEffect(() => {
    // Fresh machine state per run.
    sessionStore.replaceState(createInitialSessionState())
    fusionSignal.set(initialFusionFrame)
    recapSignal.set({ record: null, debriefStatus: 'idle' })
    sessionStore.dispatch({ type: 'START_REQUESTED' })

    const sink: DemoSink = {
      dispatch: (event) => sessionStore.dispatch(event),
      setVolume: (v) => volumeSignal.set(v),
      setFrame: (frame) => {
        fusionSignal.set({
          ...initialFusionFrame,
          wordsPerMinute: frame.wordsPerMinute ?? fusionSignal.get().wordsPerMinute,
          speedLevel: frame.speedLevel ?? fusionSignal.get().speedLevel,
          highRiskKeywords: frame.highRiskKeywords ?? [],
          latestHighRiskKeyword: frame.latestHighRiskKeyword ?? null,
          fusionMode: frame.fusionMode ?? 'llm',
          llmTone: frame.llmTone ?? null,
        })
      },
      setSuggestion: (s) => setSuggestion(s),
      setRecap: (record) => {
        recapSignal.set({ record, debriefStatus: 'ready' })
      },
    }

    const startedAt = performance.now()
    const timers: number[] = []

    for (const step of DEMO_STEPS) {
      timers.push(window.setTimeout(() => step.run(sink, Date.now()), step.at))
    }

    // 1s TICK heartbeat — the machine's own sustain logic fires the breathing morph.
    const tick = window.setInterval(() => {
      sessionStore.dispatch({ type: 'TICK', at: Date.now() })
    }, 1_000)

    // Ambient volume driver: keyframe base + a talking wobble, 10Hz.
    let t = 0
    const vol = window.setInterval(() => {
      t += 1
      const elapsed = performance.now() - startedAt
      if (elapsed > DEMO_DURATION_MS - 4_000) {
        sink.setVolume(0)
        return
      }
      const base = volumeBaseAt(elapsed)
      sink.setVolume(Math.max(0, base + Math.sin(t / 2.3) * 10 + Math.sin(t / 0.9) * 6))
    }, 100)

    const prog = window.setInterval(() => {
      setProgress(Math.min(1, (performance.now() - startedAt) / DEMO_DURATION_MS))
    }, 250)

    return () => {
      timers.forEach((id) => window.clearTimeout(id))
      window.clearInterval(tick)
      window.clearInterval(vol)
      window.clearInterval(prog)
      volumeSignal.set(0)
      sessionStore.replaceState(createInitialSessionState())
      fusionSignal.set(initialFusionFrame)
    }
  }, [runId])

  return { progress, suggestion, restart: () => setRunId((id) => id + 1) }
}

export default function DemoPage() {
  const copy = useDemoT()
  const liveCopy = useLiveSessionT()
  const { progress, suggestion, restart } = useDemoPlayer()

  const phase = useSessionPhase()
  const score = useSessionScore()
  const emotionLevel = useEmotionLevel()
  const history = useScoreHistory()
  const transcript = useTranscript()
  const interim = useInterim()
  const engines = useEngines()
  const frame = useSignalValue(fusionSignal)

  const trend = useMemo(() => {
    if (history.length < 2) return '→'
    const sample = history.slice(-4)
    const diff = sample[sample.length - 1].score - sample[0].score
    return diff > 5 ? '↑' : diff < -5 ? '↓' : '→'
  }, [history])

  const rateValue = Math.min(100, Math.round(frame.wordsPerMinute / 2.4))
  const semanticValue = frame.llmTone && frame.fusionMode === 'llm' ? frame.llmTone.intensity : 0
  const ended = phase === 'recap' || progress >= 1

  return (
    <div className="min-h-screen text-ink">
      <Aurora />
      <div className="mx-auto w-full max-w-md px-4 pb-24 pt-6">
        <nav className="mb-4 flex items-center justify-between">
          <Link href="/" className="text-sm font-semibold text-brand hover:brightness-110">
            ← {copy.back}
          </Link>
          <ThemeToggle ariaLabel={copy.themeToggle} />
        </nav>

        {/* player chrome */}
        <div className="mb-4 rounded-card border border-brand/40 bg-brand/10 px-4 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold text-brand">{copy.chip}</p>
            <button
              type="button"
              onClick={restart}
              className="shrink-0 rounded-full border border-brand/40 px-3 py-1 text-xs font-semibold text-brand hover:bg-brand/10"
            >
              ⟳ {copy.restart}
            </button>
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-sunken">
            <div
              className="rm-static h-full bg-brand transition-[width] duration-300"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>

        {phase === 'recap' ? (
          <>
            <RecapView />
            <p className="mt-3 text-center text-xs text-ink-muted">{copy.endedNote}</p>
          </>
        ) : (
          <section className="mb-5 rounded-sheet border border-line bg-raised/80 p-5 shadow-e2 backdrop-blur">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium text-ink-secondary">{liveCopy.dashboard}</p>
              <span className="flex items-center gap-1.5" role="status">
                {engines.analysis === 'rules' && (
                  <span className="rounded-full border border-line-strong bg-sunken px-2 py-0.5 text-xs font-semibold text-ink-secondary">
                    {liveCopy.rulesMode}
                  </span>
                )}
                <span
                  className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${
                    engines.stt === 'groq'
                      ? 'border-brand/40 bg-brand/10 text-brand'
                      : 'border-accent/40 bg-accent/10 text-accent'
                  }`}
                >
                  {engines.stt === 'groq' ? liveCopy.engineGroq : liveCopy.engineBrowser}
                </span>
              </span>
            </div>

            {phase === 'intervention' ? (
              <BreathingGuide staticGrounding="You're one breath away from a better sentence." />
            ) : (
              <ToneGauge
                score={score}
                level={emotionLevel}
                rateValue={rateValue}
                semanticValue={semanticValue}
                trendIcon={trend}
                trendLabel=""
              />
            )}

            {frame.fusionMode === 'llm' && frame.llmTone && phase !== 'intervention' && (
              <p className="mt-1 text-center text-xs text-ink-muted">
                <span className="font-semibold text-brand">{frame.llmTone.tone}</span>
                {frame.llmTone.rationale ? ` · ${frame.llmTone.rationale}` : ''}
              </p>
            )}

            <div
              className="mt-5 max-h-44 min-h-28 overflow-y-auto rounded-card border border-line bg-sunken/60 p-3"
              role="log"
            >
              {transcript.length === 0 && !interim && (
                <p className="text-sm text-ink-muted">{liveCopy.emptyTranscript}</p>
              )}
              <div className="space-y-2">
                {transcript.map((entry) => (
                  <p key={entry.timestamp} className="text-sm text-ink">
                    {entry.text}
                  </p>
                ))}
              </div>
            </div>
          </section>
        )}

        {ended && (
          <div className="mt-4 flex justify-center">
            <Link
              href="/app"
              className="rounded-full bg-accent-fill px-8 py-3 text-sm font-semibold text-on-accent shadow-e2 transition hover:brightness-110"
            >
              {copy.tryLive} →
            </Link>
          </div>
        )}
      </div>

      <SessionRibbon />
      <ToneSuggestion triggerKeyword={null} llmSuggestion={suggestion} />
    </div>
  )
}
