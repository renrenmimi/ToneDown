import { useMemo, useState } from 'react'
import type { ToneLabel } from '@/types/api'
import type { EmotionHistoryEntry, SignalBreakdown } from '@/types/app'
import { useLiveSessionT } from '../i18n'
import {
  dominantDriver,
  evidenceShares,
  formatPoints,
  pointsFor,
  trackValues,
  type ReminderEvent,
} from '../lib/explain'
import { useReminders, useScoreHistory, useSession } from '../machine/selectors'

// The explanation view: the same session, drawn as TWO tracks that never mix.
//
//   top    — acoustic: what the microphone measured (loudness, pace)
//   bottom — semantic: what the words meant (model tone read, local lexicon)
//
// Reminder markers sit across both tracks, and every marker has a card below
// stating the rule it satisfied and the arithmetic that got it there. The
// numbers come from the stored per-tick breakdown, never recomputed, so the
// explanation and the gauge can never disagree.

const VIEW_W = 600
const TRACK_H = 24
const TRACK_GAP = 10
const VIEW_H = TRACK_H * 2 + TRACK_GAP
/** Nominal tick width used for the trailing sample's bar. */
const TICK_MS = 2_000

const TONE_FILL: Record<ToneLabel, string> = {
  aggressive: 'var(--tone-hostile)',
  'passive-aggressive': 'var(--tone-heated)',
  defensive: 'var(--tone-tense)',
  neutral: 'var(--tone-calm)',
  positive: 'var(--tone-calm)',
}

type ScoredEntry = EmotionHistoryEntry & { signals: SignalBreakdown }

interface Bar {
  at: number
  x: number
  width: number
  acoustic: number
  semantic: number
  fill: string
  hasKeyword: boolean
}

function formatClock(at: number, startedAt: number | null): string {
  const elapsed = Math.max(0, Math.floor((at - (startedAt ?? at)) / 1000))
  return `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`
}

export function ExplanationTimeline() {
  const copy = useLiveSessionT()
  const history = useScoreHistory()
  const reminders = useReminders()
  const startedAt = useSession((s) => s.startedAt)
  const [selected, setSelected] = useState<number | null>(null)

  const layout = useMemo(() => {
    const scored = history.filter((entry): entry is ScoredEntry => entry.signals !== undefined)
    if (scored.length < 2) {
      return null
    }

    const t0 = scored[0].timestamp
    // Markers fired by the 1s heartbeat can land after the last scored tick;
    // widening the domain keeps every one of them inside the chart.
    const lastAt = Math.max(
      scored[scored.length - 1].timestamp + TICK_MS,
      ...reminders.map((reminder) => reminder.at + TICK_MS),
    )
    const span = lastAt - t0
    if (span <= 0) {
      return null
    }

    const bars: Bar[] = scored.map((entry, index) => {
      const values = trackValues(entry.signals)
      const endsAt = scored[index + 1]?.timestamp ?? lastAt
      return {
        at: entry.timestamp,
        x: ((entry.timestamp - t0) / span) * VIEW_W,
        width: Math.max(2, ((endsAt - entry.timestamp) / span) * VIEW_W),
        acoustic: values.acoustic,
        semantic: values.semantic,
        fill: values.tone ? TONE_FILL[values.tone] : 'var(--text-muted)',
        hasKeyword: values.hasKeyword,
      }
    })

    return { bars, t0, span }
  }, [history, reminders])

  if (!layout) {
    return null
  }

  const { bars, t0, span } = layout
  const position = (at: number) => ((at - t0) / span) * 100

  return (
    <section className="mb-5 rounded-sheet border border-line bg-raised/80 p-5 shadow-e2 backdrop-blur">
      <p className="text-sm font-medium text-ink-secondary">{copy.explain.title}</p>
      <p className="mt-1 text-xs text-ink-muted">{copy.explain.hint}</p>

      <div className="mt-4 space-y-1">
        <TrackLegend
          swatch="var(--signal-acoustic)"
          label={copy.explain.trackAcoustic}
          hint={copy.explain.trackAcousticHint}
        />

        <div className="relative">
          <svg
            viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
            preserveAspectRatio="none"
            className="h-16 w-full"
            role="img"
            aria-label={copy.explain.chartLabel}
          >
            <rect x={0} y={0} width={VIEW_W} height={TRACK_H} rx={3} className="fill-sunken" />
            <rect
              x={0}
              y={TRACK_H + TRACK_GAP}
              width={VIEW_W}
              height={TRACK_H}
              rx={3}
              className="fill-sunken"
            />

            {bars.map((bar) => {
              const acousticH = (bar.acoustic / 100) * TRACK_H
              const semanticH = (bar.semantic / 100) * TRACK_H
              const semanticTop = TRACK_H + TRACK_GAP
              return (
                <g key={bar.at}>
                  <rect
                    x={bar.x}
                    y={TRACK_H - acousticH}
                    width={bar.width}
                    height={acousticH}
                    fill="var(--signal-acoustic)"
                    fillOpacity={0.85}
                  />
                  <rect
                    x={bar.x}
                    y={semanticTop + (TRACK_H - semanticH)}
                    width={bar.width}
                    height={semanticH}
                    fill={bar.fill}
                    fillOpacity={0.85}
                  />
                  {bar.hasKeyword && (
                    <rect
                      x={bar.x}
                      y={semanticTop}
                      width={Math.max(2, bar.width)}
                      height={3}
                      fill="var(--accent)"
                    />
                  )}
                </g>
              )
            })}
          </svg>

          {reminders.map((reminder, index) => (
            <button
              key={reminder.at}
              type="button"
              aria-pressed={selected === reminder.at}
              aria-label={`${copy.explain.heading(index + 1, formatClock(reminder.at, startedAt))} — ${copy.explain.kind[reminder.kind]}`}
              onClick={() => setSelected(selected === reminder.at ? null : reminder.at)}
              className={`absolute -top-1 bottom-0 w-5 -translate-x-1/2 cursor-pointer border-x border-dashed border-tone-hostile/60 bg-transparent ${
                selected === reminder.at ? 'border-solid' : ''
              }`}
              style={{ left: `${position(reminder.at).toFixed(2)}%` }}
            >
              <span
                className={`mx-auto flex h-4 w-4 items-center justify-center rounded-full border text-[9px] font-bold tabular-nums shadow-e1 ${
                  selected === reminder.at
                    ? 'border-tone-hostile bg-tone-hostile text-white'
                    : 'border-tone-hostile bg-raised text-tone-hostile'
                }`}
              >
                {index + 1}
              </span>
            </button>
          ))}
        </div>

        <TrackLegend
          swatch="var(--tone-heated)"
          label={copy.explain.trackSemantic}
          hint={copy.explain.trackSemanticHint}
        />

        <div className="flex justify-between pt-1 text-[10px] text-ink-muted">
          <span>{copy.explain.axisStart}</span>
          <span>{copy.explain.axisEnd}</span>
        </div>
      </div>

      {reminders.length === 0 ? (
        <p className="mt-4 rounded-card border border-line bg-sunken/50 p-3 text-sm text-ink-muted">
          {copy.explain.empty}
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {reminders.map((reminder, index) => (
            <li key={reminder.at}>
              <ReminderCard
                reminder={reminder}
                index={index + 1}
                clock={formatClock(reminder.at, startedAt)}
                selected={selected === reminder.at}
                onSelect={() => setSelected(selected === reminder.at ? null : reminder.at)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function TrackLegend({ swatch, label, hint }: { swatch: string; label: string; hint: string }) {
  return (
    <p className="flex flex-wrap items-baseline gap-x-2 text-[11px] text-ink-secondary">
      <span
        aria-hidden="true"
        className="inline-block h-2 w-2 shrink-0 translate-y-px rounded-full"
        style={{ background: swatch }}
      />
      <span className="font-semibold">{label}</span>
      <span className="text-ink-muted">{hint}</span>
    </p>
  )
}

interface ReminderCardProps {
  reminder: ReminderEvent
  index: number
  clock: string
  selected: boolean
  onSelect: () => void
}

function ReminderCard({ reminder, index, clock, selected, onSelect }: ReminderCardProps) {
  const copy = useLiveSessionT()
  const { signals } = reminder

  return (
    <div
      className={`rounded-card border bg-sunken/50 p-3 transition ${
        selected ? 'border-tone-hostile/60 shadow-e1' : 'border-line'
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className="flex w-full flex-wrap items-center gap-2 text-left"
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-full border border-tone-hostile text-[10px] font-bold tabular-nums text-tone-hostile">
          {index}
        </span>
        <span className="text-sm font-semibold text-ink">{copy.explain.heading(index, clock)}</span>
        <span className="rounded-full border border-line-strong bg-raised px-2 py-0.5 text-[10px] font-semibold text-ink-secondary">
          {copy.explain.kind[reminder.kind]}
        </span>
      </button>

      <p className="mt-2 text-xs text-ink-secondary">
        {copy.explain.rule[reminder.kind]} {copy.explain.scoreAtTrigger(reminder.score)}
      </p>

      {signals === null ? (
        <p className="mt-2 text-xs text-ink-muted">{copy.explain.noSignals}</p>
      ) : (
        <TriggerEvidence signals={signals} score={reminder.score} />
      )}

      {reminder.quote && (
        <p className="mt-3 border-l-2 border-tone-hostile pl-2 text-sm text-ink">
          <span className="mr-1 text-xs text-ink-muted">{copy.explain.quoteLabel}:</span>
          {reminder.quote}
        </p>
      )}
    </div>
  )
}

function TriggerEvidence({ signals, score }: { signals: SignalBreakdown; score: number }) {
  const copy = useLiveSessionT()
  const parts = pointsFor(signals, score)
  const shares = evidenceShares(signals)
  const driver = dominantDriver(signals)
  const keywords = [...signals.semantic.highRiskKeywords, ...signals.semantic.mediumRiskKeywords]

  return (
    <>
      <p className="mt-2 text-xs">
        <span className="text-ink-muted">{copy.explain.driverLabel}: </span>
        <span className="font-semibold text-brand">{copy.explain.driver[driver]}</span>
      </p>

      <dl className="mt-2 space-y-1 text-xs">
        <EvidenceRow
          swatch="var(--signal-acoustic)"
          term={copy.explain.trackAcoustic}
          detail={copy.explain.acousticLine(
            signals.acoustic.volume,
            copy.speedLabel[signals.acoustic.speedLevel],
            formatPoints(parts.acoustic),
          )}
        />
        <EvidenceRow
          swatch={signals.semantic.tone ? TONE_FILL[signals.semantic.tone] : 'var(--text-muted)'}
          term={copy.explain.trackSemantic}
          detail={
            signals.semantic.tone
              ? copy.explain.semanticLine(
                  copy.explain.tone[signals.semantic.tone],
                  Math.round(signals.semantic.intensity),
                  formatPoints(parts.semantic),
                )
              : copy.explain.semanticIdleLine
          }
        />
        <EvidenceRow
          swatch="var(--accent)"
          term={copy.explain.keywordTick}
          detail={
            keywords.length > 0
              ? copy.explain.keywordLine(
                  keywords.join(copy.explain.keywordSeparator),
                  formatPoints(parts.keyword),
                )
              : copy.explain.keywordNone
          }
        />
      </dl>

      <div
        className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-sunken"
        role="img"
        aria-label={`${copy.explain.shareLabel}: ${Math.round(shares.acoustic * 100)}% / ${Math.round(shares.semantic * 100)}% / ${Math.round(shares.keyword * 100)}%`}
      >
        <span style={{ width: `${shares.acoustic * 100}%`, background: 'var(--signal-acoustic)' }} />
        <span
          style={{
            width: `${shares.semantic * 100}%`,
            background: signals.semantic.tone ? TONE_FILL[signals.semantic.tone] : 'var(--text-muted)',
          }}
        />
        <span style={{ width: `${shares.keyword * 100}%`, background: 'var(--accent)' }} />
      </div>

      {signals.semantic.floorApplied && (
        <p className="mt-2 text-xs text-ink-muted">{copy.explain.floorNote}</p>
      )}
      {signals.mode === 'rules' && (
        <p className="mt-2 text-xs text-ink-muted">{copy.explain.lexiconOnly}</p>
      )}
    </>
  )
}

function EvidenceRow({ swatch, term, detail }: { swatch: string; term: string; detail: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span
        aria-hidden="true"
        className="inline-block h-2 w-2 shrink-0 translate-y-px rounded-full"
        style={{ background: swatch }}
      />
      <dt className="sr-only">{term}</dt>
      <dd className="text-ink-secondary">{detail}</dd>
    </div>
  )
}
