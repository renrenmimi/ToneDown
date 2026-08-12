import { useState } from 'react'
import { Link } from 'wouter'
import { useHoldToTalk } from '@/features/sparring/useHoldToTalk'
import { useLocale } from '@/shared/i18n/localeContext'
import { Aurora } from '@/shared/ui/Aurora'
import { Confetti } from '@/shared/ui/Confetti'
import { LocaleToggle } from '@/shared/ui/LocaleToggle'
import { ThemeToggle } from '@/shared/ui/ThemeToggle'
import { useGymT } from './i18n'
import { useGym } from './useGym'

export default function GymPage() {
  const copy = useGymT()
  const { locale } = useLocale()
  const { state, grade } = useGym(locale)
  const [attempt, setAttempt] = useState('')
  const [hintShown, setHintShown] = useState(false)
  const holdToTalk = useHoldToTalk(locale, (text) =>
    setAttempt((prev) => (prev ? prev + ' ' : '') + text),
  )

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    void grade(attempt)
  }

  const justPassed = state.status === 'done' && state.lastGrade?.passed === true

  return (
    <div className="min-h-screen text-ink">
      <Aurora />
      {justPassed && <Confetti />}
      <div className="mx-auto w-full max-w-md px-4 pb-16 pt-6">
        <nav className="mb-5 flex items-center justify-between">
          <Link href="/app" className="text-sm font-semibold text-brand hover:brightness-110">
            ← {copy.back}
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle ariaLabel={copy.themeToggle} />
            <LocaleToggle />
          </div>
        </nav>

        <div className="flex items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">{copy.title}</h1>
            <p className="mt-2 text-sm text-ink-secondary">{copy.subtitle}</p>
          </div>
          {state.streak > 0 && (
            <p className="shrink-0 rounded-full border border-brand/40 bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
              🔥 {copy.streakLabel(state.streak)}
            </p>
          )}
        </div>

        <section className="mt-6 rounded-sheet border border-line bg-raised/80 p-5 shadow-e2 backdrop-blur">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              {copy.todayLabel}
            </p>
            {state.clearedToday && (
              <p className="text-xs font-semibold text-brand">{copy.clearedToday}</p>
            )}
          </div>
          <p className="mt-3 border-l-2 border-tone-hostile pl-3 text-lg font-semibold text-ink">
            {state.drill.phrase}
          </p>

          {hintShown ? (
            <p className="mt-3 rounded-card border border-line bg-sunken/50 p-3 text-xs text-ink-secondary">
              {copy.hintLabel}: {state.drill.hint}
            </p>
          ) : (
            <button
              type="button"
              className="mt-3 text-xs text-ink-muted underline-offset-2 hover:text-ink hover:underline"
              onClick={() => setHintShown(true)}
            >
              {copy.showHint}
            </button>
          )}

          <form onSubmit={submit} className="mt-4">
            <div className="flex items-start gap-2">
              {holdToTalk.status !== 'unavailable' && (
                <button
                  type="button"
                  aria-label={copy.holdToTalk}
                  aria-pressed={holdToTalk.status === 'recording'}
                  disabled={holdToTalk.status === 'transcribing'}
                  onPointerDown={() => void holdToTalk.start()}
                  onPointerUp={holdToTalk.stop}
                  onPointerLeave={holdToTalk.stop}
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border text-base shadow-e1 transition ${
                    holdToTalk.status === 'recording'
                      ? 'rm-static animate-pulse border-brand bg-brand/20'
                      : 'border-line bg-raised disabled:opacity-40'
                  }`}
                >
                  🎙️
                </button>
              )}
              <textarea
                value={attempt}
                onChange={(e) => setAttempt(e.target.value)}
                placeholder={copy.inputPlaceholder}
                maxLength={500}
                rows={3}
                className="min-w-0 flex-1 resize-none rounded-field border border-line bg-raised px-4 py-3 text-sm text-ink placeholder:text-ink-muted focus:border-brand focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={state.status === 'grading' || attempt.trim().length < 2}
              className="mt-3 w-full rounded-full bg-accent-fill px-6 py-3 text-sm font-semibold text-on-accent shadow-e2 transition enabled:hover:brightness-110 disabled:opacity-40"
            >
              {state.status === 'grading' ? copy.grading : copy.submit}
            </button>
          </form>

          {state.status === 'failed' && (
            <p className="mt-3 text-xs text-ink-muted">{copy.apiDown}</p>
          )}

          {state.status === 'done' && state.lastGrade && (
            <div className="mt-5 rounded-card border border-line bg-sunken/50 p-4">
              <p
                className="font-display text-5xl font-bold tabular-nums"
                style={{
                  color: state.lastGrade.passed ? 'var(--tone-calm)' : 'var(--tone-tense)',
                }}
              >
                {state.lastGrade.score}
              </p>
              <p className="mt-2 text-sm text-ink">
                {state.lastGrade.passed
                  ? copy.passLine(state.lastGrade.score)
                  : copy.failLine(state.lastGrade.score)}
              </p>
              <p className="mt-2 text-xs text-ink-secondary">{state.lastGrade.feedback}</p>
              <p className="mt-3 border-l-2 border-brand pl-2 text-xs text-ink-secondary">
                {copy.betterLabel}: {state.lastGrade.better_version}
              </p>
            </div>
          )}
        </section>

        {state.achievements.length > 0 && (
          <section className="mt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              {copy.achievementsTitle}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {state.achievements.map((id) => (
                <span
                  key={id}
                  title={copy.achievements[id].desc}
                  className="rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent"
                >
                  🏅 {copy.achievements[id].name}
                </span>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
