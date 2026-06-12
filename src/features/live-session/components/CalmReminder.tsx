import { useEffect, useState } from 'react'
import { useLiveSessionT } from '../i18n'
import { useSession, useSessionPhase } from '../machine/selectors'
import { sessionStore } from '../machine/sessionStore'
import { INTERVENTION_DURATION_MS } from '../machine/sessionMachine'

const REMINDER_DURATION_SECONDS = INTERVENTION_DURATION_MS / 1_000

/**
 * Pure view of the machine's `intervention` phase. All trigger timing
 * (sustain, cooldown, auto-dismiss) lives in the session reducer; this
 * component only renders the countdown and dispatches the acknowledgement.
 */
export function CalmReminder() {
  const copy = useLiveSessionT().calmReminder
  const phase = useSessionPhase()
  const endsAt = useSession((s) => s.interventionEndsAt)

  const isVisible = phase === 'intervention' && endsAt !== null

  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!isVisible) {
      return
    }
    const timerId = window.setInterval(() => {
      setNow(Date.now())
    }, 1_000)
    return () => {
      window.clearInterval(timerId)
    }
  }, [isVisible])

  if (!isVisible) {
    return null
  }

  const countdown = Math.min(
    REMINDER_DURATION_SECONDS,
    Math.max(0, Math.ceil((endsAt - now) / 1_000)),
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-sunken/80 p-6 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-sheet border border-line bg-overlay/95 p-6 text-center shadow-e3">
        <h3 className="font-display text-3xl font-bold text-brand">{copy.title}</h3>
        <p className="mt-3 text-sm text-ink-secondary">{copy.description}</p>

        <div className="my-6 flex justify-center">
          <div
            className="h-28 w-28 rounded-full bg-brand/30 shadow-[0_0_50px_var(--brand)] animate-pulse"
            style={{ animationDuration: '4s' }}
          />
        </div>

        <p className="text-base text-ink-secondary">
          {copy.countdown}: <span className="font-display font-semibold tabular-nums text-brand">{countdown}s</span>
        </p>

        <button
          type="button"
          className="mt-5 w-full rounded-full bg-accent-fill px-4 py-3 text-sm font-semibold text-on-accent transition hover:brightness-110"
          onClick={() => {
            sessionStore.dispatch({ type: 'INTERVENTION_ACKNOWLEDGED', at: Date.now() })
          }}
        >
          {copy.button}
        </button>
      </div>
    </div>
  )
}
