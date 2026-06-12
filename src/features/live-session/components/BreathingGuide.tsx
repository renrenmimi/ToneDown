import { useEffect, useRef, useState } from 'react'
import { rewriteEndpoint } from '@/shared/llm/endpoints'
import { useLocale } from '@/shared/i18n/localeContext'
import { useLiveSessionT } from '../i18n'
import { useSession } from '../machine/selectors'
import { sessionStore } from '../machine/sessionStore'

// The intervention: the gauge's slot becomes a 4-7-8 breathing guide.
// Phase timing is a tiny JS chain (3 timeouts/cycle — sturdier than
// syncing CSS keyframes to text); the circle animates transform-only.
// Auto-dismiss after 2 cycles lives in the session machine (38s).

const PHASES = [
  { id: 'inhale', seconds: 4, scale: 1 },
  { id: 'hold', seconds: 7, scale: 1 },
  { id: 'exhale', seconds: 8, scale: 0.62 },
] as const

type BreathPhase = (typeof PHASES)[number]['id']

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  )
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}

interface BreathingGuideProps {
  /** Demo mode: skip the LLM grounding fetch and show this line instead. */
  staticGrounding?: string
}

export function BreathingGuide({ staticGrounding }: BreathingGuideProps = {}) {
  const copy = useLiveSessionT()
  const { locale } = useLocale()
  const reducedMotion = usePrefersReducedMotion()
  const transcript = useSession((s) => s.transcript)

  const [phaseIndex, setPhaseIndex] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState<number>(PHASES[0].seconds)
  const [grounding, setGrounding] = useState<string | null>(null)

  // One grounding line per intervention; static fallback when the LLM is
  // unreachable or over budget.
  const requestedRef = useRef(false)
  useEffect(() => {
    if (requestedRef.current) {
      return
    }
    requestedRef.current = true
    if (staticGrounding !== undefined) {
      return
    }
    const lastLine = transcript[transcript.length - 1]?.text ?? ''
    if (lastLine.length < 4 || !rewriteEndpoint.canAttempt()) {
      return
    }
    // No cancellation on cleanup: StrictMode remounts share this instance's
    // refs, so cancelling would orphan the only request ever made. A setState
    // after unmount is a safe no-op in React 18+.
    void rewriteEndpoint
      .call({ kind: 'grounding', utterance: lastLine, language: locale })
      .then((result) => {
        setGrounding(result.rewrite)
      })
      .catch(() => {
        // fallback text already rendered
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Phase chain + per-second countdown.
  useEffect(() => {
    const phase = PHASES[phaseIndex]
    setSecondsLeft(phase.seconds)
    const phaseTimer = window.setTimeout(() => {
      setPhaseIndex((i) => (i + 1) % PHASES.length)
    }, phase.seconds * 1_000)
    const secondTimer = window.setInterval(() => {
      setSecondsLeft((s) => Math.max(1, s - 1))
    }, 1_000)
    return () => {
      window.clearTimeout(phaseTimer)
      window.clearInterval(secondTimer)
    }
  }, [phaseIndex])

  const phase = PHASES[phaseIndex]
  const label: Record<BreathPhase, string> = {
    inhale: copy.breath.inhale,
    hold: copy.breath.hold,
    exhale: copy.breath.exhale,
  }

  return (
    <div className="flex flex-col items-center py-2 text-center">
      <p className="text-sm text-ink-secondary">
        {staticGrounding ?? grounding ?? copy.breath.fallback}
      </p>

      <div className="relative my-6 flex h-56 w-56 items-center justify-center">
        {reducedMotion ? (
          <div className="flex h-44 w-44 flex-col items-center justify-center rounded-full border-2 border-brand/60 bg-brand/10">
            <p className="font-display text-2xl font-bold text-brand">{label[phase.id]}</p>
            <div className="mt-3 flex gap-1.5" aria-hidden>
              {PHASES.map((p, i) => (
                <span
                  key={p.id}
                  className={`h-1.5 w-8 rounded-full ${i <= phaseIndex ? 'bg-brand' : 'bg-line'}`}
                />
              ))}
            </div>
          </div>
        ) : (
          <>
            <div
              className="absolute h-44 w-44 rounded-full border-2 border-brand/60 bg-brand/15 shadow-[0_0_60px_var(--brand)]"
              style={{
                transform: `scale(${phase.scale})`,
                transition: `transform ${phase.seconds}s var(--ease-breath)`,
              }}
              aria-hidden
            />
            <div className="relative">
              <p className="font-display text-2xl font-bold text-brand">{label[phase.id]}</p>
            </div>
          </>
        )}
      </div>

      <p className="text-sm text-ink-muted" aria-live="polite">
        {label[phase.id]} ·{' '}
        <span className="font-display font-semibold tabular-nums text-brand">{secondsLeft}</span>
      </p>

      <button
        type="button"
        className="mt-5 rounded-full bg-accent-fill px-8 py-3 text-sm font-semibold text-on-accent shadow-e2 transition hover:brightness-110"
        onClick={() => {
          sessionStore.dispatch({ type: 'INTERVENTION_ACKNOWLEDGED', at: Date.now() })
        }}
      >
        {copy.breath.steady}
      </button>
    </div>
  )
}
