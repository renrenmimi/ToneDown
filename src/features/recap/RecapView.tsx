import { sessionStore } from '@/features/live-session/machine/sessionStore'
import { useLocale } from '@/shared/i18n/localeContext'
import { useSignalValue } from '@/shared/state/signalBus'
import { downloadRecapPng } from './recapPng'
import { ArcSparkline } from './ArcSparkline'
import { recapSignal } from './recapStore'
import { useRecapT } from './i18n'

function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

/** Post-session recap, rendered by /app while the machine sits in `recap`. */
export function RecapView() {
  const copy = useRecapT()
  const { locale } = useLocale()
  const { record, debriefStatus } = useSignalValue(recapSignal)

  if (!record) {
    // Stopped before any scoring happened: nothing to recap.
    return (
      <section className="mb-5 rounded-sheet border border-line bg-raised/80 p-6 text-center shadow-e2 backdrop-blur">
        <button
          type="button"
          className="rounded-full bg-accent-fill px-8 py-3 text-sm font-semibold text-on-accent shadow-e2 transition hover:brightness-110"
          onClick={() => sessionStore.dispatch({ type: 'RECAP_CLOSED' })}
        >
          {copy.newSession}
        </button>
      </section>
    )
  }

  const debrief = record.debrief

  return (
    <section className="mb-5 rounded-sheet border border-line bg-raised/80 p-6 shadow-e2 backdrop-blur">
      <p className="text-sm text-ink-secondary">
        {record.calmScore >= 60 ? copy.headlineCalm : copy.headlineStormy}
      </p>

      <div className="mt-4 flex items-end justify-between gap-4">
        <div>
          <p
            className="font-display text-6xl font-bold tabular-nums leading-none"
            style={{ color: record.calmScore >= 60 ? 'var(--tone-calm)' : 'var(--tone-tense)' }}
          >
            {record.calmScore}
          </p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-ink-secondary">
            {copy.calmScoreLabel}
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-right text-xs text-ink-muted">
          <dt>{copy.duration}</dt>
          <dd className="tabular-nums text-ink">{formatDuration(record.durationMs)}</dd>
          <dt>{copy.peak}</dt>
          <dd className="tabular-nums text-ink">{record.peakScore}</dd>
          <dt>{copy.breaths}</dt>
          <dd className="tabular-nums text-ink">{record.interventionCount}</dd>
          <dt>{copy.flagged}</dt>
          <dd className="tabular-nums text-ink">{record.flaggedMoments.length}</dd>
        </dl>
      </div>

      <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-ink-muted">
        {copy.arcTitle}
      </p>
      <div className="mt-2 rounded-card border border-line bg-sunken/50 p-2">
        <ArcSparkline series={record.scoreSeries} durationMs={record.durationMs} />
      </div>

      {debriefStatus === 'loading' && (
        <p className="mt-5 animate-pulse text-sm text-ink-muted">{copy.debriefLoading}</p>
      )}
      {debriefStatus === 'failed' && (
        <p className="mt-5 text-sm text-ink-muted">{copy.debriefFailed}</p>
      )}

      {debrief && (
        <div className="mt-5 space-y-5">
          <div>
            <p className="text-sm leading-relaxed text-ink">{debrief.summary}</p>
            <p className="mt-1 text-sm italic text-ink-secondary">{debrief.emotional_arc}</p>
          </div>

          {debrief.trigger_moments.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                {copy.triggersTitle}
              </p>
              <ul className="mt-2 space-y-3">
                {debrief.trigger_moments.map((moment) => (
                  <li
                    key={moment.quote}
                    className="rounded-card border border-line bg-sunken/50 p-3 text-sm"
                  >
                    <p className="border-l-2 border-tone-hostile pl-2 text-ink">{moment.quote}</p>
                    <p className="mt-2 text-xs text-ink-muted">
                      {copy.whyLabel}: {moment.why_it_escalated}
                    </p>
                    <p className="mt-1 text-xs text-brand">
                      {copy.betterLabel}: {moment.better_phrasing}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-card border-l-4 border-accent bg-accent/10 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              {copy.habitTitle}
            </p>
            <p className="mt-1 text-sm text-ink">{debrief.one_habit_to_practice}</p>
          </div>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="rounded-full bg-accent-fill px-7 py-3 text-sm font-semibold text-on-accent shadow-e2 transition hover:brightness-110"
          onClick={() => sessionStore.dispatch({ type: 'RECAP_CLOSED' })}
        >
          {copy.newSession}
        </button>
        <button
          type="button"
          className="rounded-full border border-line-strong bg-raised/70 px-7 py-3 text-sm font-semibold text-ink-secondary transition hover:text-ink"
          onClick={() => {
            void downloadRecapPng(record, locale)
          }}
        >
          {copy.downloadCard}
        </button>
        <span className="text-xs text-ink-muted">{copy.savedLocally}</span>
      </div>
    </section>
  )
}
