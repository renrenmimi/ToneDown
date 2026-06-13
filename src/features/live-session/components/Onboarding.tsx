import { useState } from 'react'
import { useLiveSessionT } from '../i18n'
import { ONBOARDING_KEY } from '../lib/onboardingFlag'

/** Three-screen first-visit overlay. The mic is only requested on Start —
 * explained here so the permission prompt never feels like an ambush. */
export function Onboarding({ onDone }: { onDone: () => void }) {
  const copy = useLiveSessionT().onboarding
  const [step, setStep] = useState(0)

  const screens = [copy.one, copy.two, copy.three]
  const screen = screens[step]
  const last = step === screens.length - 1

  const finish = () => {
    try {
      localStorage.setItem(ONBOARDING_KEY, '1')
    } catch {
      // fine
    }
    onDone()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={copy.ariaLabel}
      className="fixed inset-0 z-50 flex items-center justify-center bg-sunken/80 p-6 backdrop-blur-sm"
    >
      <div className="w-full max-w-sm rounded-sheet border border-line bg-overlay/95 p-6 text-center shadow-e3">
        <p className="text-4xl" aria-hidden>
          {screen.emoji}
        </p>
        <h2 className="mt-3 font-display text-2xl font-bold">{screen.title}</h2>
        <p className="mt-3 text-sm leading-relaxed text-ink-secondary">{screen.body}</p>

        <div className="mt-6 flex items-center justify-center gap-1.5" aria-hidden>
          {screens.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-brand' : 'w-1.5 bg-line'}`}
            />
          ))}
        </div>

        <div className="mt-5 flex items-center justify-center gap-3">
          {!last && (
            <button
              type="button"
              className="rounded-full border border-line-strong bg-raised px-6 py-2.5 text-sm font-semibold text-ink-secondary hover:text-ink"
              onClick={finish}
            >
              {copy.skip}
            </button>
          )}
          <button
            type="button"
            className="rounded-full bg-accent-fill px-7 py-2.5 text-sm font-semibold text-on-accent shadow-e1 hover:brightness-110"
            onClick={() => (last ? finish() : setStep(step + 1))}
          >
            {last ? copy.done : copy.next}
          </button>
        </div>
      </div>
    </div>
  )
}
