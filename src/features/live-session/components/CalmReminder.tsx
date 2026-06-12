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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-6 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-3xl border border-slate-700 bg-slate-900/95 p-6 text-center shadow-2xl">
        <h3 className="text-3xl font-bold text-emerald-300">{copy.title}</h3>
        <p className="mt-3 text-sm text-slate-200">{copy.description}</p>

        <div className="my-6 flex justify-center">
          <div
            className="h-28 w-28 rounded-full bg-emerald-400/30 shadow-[0_0_50px_rgba(16,185,129,0.35)] animate-pulse"
            style={{ animationDuration: '4s' }}
          />
        </div>

        <p className="text-base text-slate-300">
          {copy.countdown}: <span className="font-semibold text-emerald-300">{countdown}s</span>
        </p>

        <button
          type="button"
          className="mt-5 w-full rounded-full bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
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
