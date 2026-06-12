import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'wouter'
import { useLocale } from '@/shared/i18n/localeContext'
import { Aurora } from '@/shared/ui/Aurora'
import { Confetti } from '@/shared/ui/Confetti'
import { ThemeToggle } from '@/shared/ui/ThemeToggle'
import type { EmotionLevel } from '@/types/app'
import { useSparringT } from './i18n'
import { moodWeather, PERSONAS, TURN_CAP, type PersonaConfig } from './personas'
import { cancelSpeech, isTtsSupported, persistMuted, readMuted, speak } from './tts'
import { useHoldToTalk } from './useHoldToTalk'
import { useSparringRound, type RoundState } from './useSparringRound'

const intensityLevel = (intensity: number): EmotionLevel =>
  intensity <= 30 ? 'calm' : intensity <= 55 ? 'elevated' : intensity <= 75 ? 'heated' : 'critical'

const TONE_CLASS: Record<EmotionLevel, string> = {
  calm: 'border-tone-calm/40 bg-tone-calm/10 text-tone-calm',
  elevated: 'border-tone-tense/40 bg-tone-tense/10 text-tone-tense',
  heated: 'border-tone-heated/40 bg-tone-heated/10 text-tone-heated',
  critical: 'border-tone-hostile/40 bg-tone-hostile/10 text-tone-hostile',
}

function persistRound(persona: PersonaConfig, state: RoundState): void {
  void import('@/shared/storage/db')
    .then(({ getDb }) =>
      getDb().sparRounds.add({
        endedAt: Date.now(),
        personaId: persona.id,
        won: state.phase === 'won',
        payload: {
          mood: state.mood,
          userTurns: state.userTurns,
          bestCalmStreak: state.bestCalmStreak,
          slips: state.slips,
        },
      }),
    )
    .catch(() => undefined)
}

function Round({
  persona,
  onExit,
  onRematch,
}: {
  persona: PersonaConfig
  onExit: () => void
  onRematch: () => void
}) {
  const copy = useSparringT()
  const { locale } = useLocale()
  const [muted, setMuted] = useState(() => readMuted())
  const [input, setInput] = useState('')
  const listRef = useRef<HTMLDivElement | null>(null)

  const mutedRef = useRef(muted)
  useEffect(() => {
    mutedRef.current = muted
  }, [muted])

  const onPartnerReply = useCallback(
    (text: string) => speak(text, persona.voice, mutedRef.current),
    [persona],
  )
  const onRoundEnd = useCallback(
    (state: RoundState) => persistRound(persona, state),
    [persona],
  )

  const personaCopy = copy.personas[persona.id]
  const { state, send } = useSparringRound(persona, personaCopy.opener, locale, onPartnerReply, onRoundEnd)
  const holdToTalk = useHoldToTalk(locale, (text) => setInput((prev) => (prev ? prev + ' ' : '') + text))

  useEffect(() => cancelSpeech, [])
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [state.turns.length, state.inFlight])

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (input.trim().length > 0) {
      send(input)
      setInput('')
    }
  }

  const ended = state.phase !== 'playing'
  const bestCalmTurn = state.turns
    .filter((t) => t.role === 'user' && t.grade?.constructive)
    .sort((a, b) => (a.grade?.intensity ?? 100) - (b.grade?.intensity ?? 100))[0]
  const worstSlip = state.slips.slice().sort((a, b) => b.intensity - a.intensity)[0]

  return (
    <div className="flex min-h-[70vh] flex-col">
      {state.phase === 'won' && <Confetti />}

      {/* header */}
      <div className="flex items-center justify-between rounded-card border border-line bg-raised/80 p-3 shadow-e1">
        <div className="flex items-center gap-3">
          <span className="text-2xl" aria-hidden>
            {persona.emoji}
          </span>
          <div>
            <p className="text-sm font-semibold text-ink">{personaCopy.name}</p>
            <p className="text-xs text-ink-muted">
              <span aria-hidden>{moodWeather(state.mood)}</span> ·{' '}
              {copy.turnsLeft(TURN_CAP - state.userTurns)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isTtsSupported() && (
            <button
              type="button"
              aria-label={muted ? copy.muteOn : copy.muteOff}
              aria-pressed={muted}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-raised text-sm shadow-e1"
              onClick={() => {
                setMuted((m) => {
                  persistMuted(!m)
                  if (!m) cancelSpeech()
                  return !m
                })
              }}
            >
              {muted ? '🔇' : '🔊'}
            </button>
          )}
          <button
            type="button"
            className="rounded-full border border-line-strong bg-sunken px-3 py-1.5 text-xs font-semibold text-ink-secondary hover:text-ink"
            onClick={onExit}
          >
            {copy.endRound}
          </button>
        </div>
      </div>

      {/* chat */}
      <div ref={listRef} className="mt-3 flex-1 space-y-3 overflow-y-auto rounded-card border border-line bg-sunken/40 p-3">
        {state.turns.map((turn, i) => (
          <div key={i} className={`flex ${turn.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className="max-w-[85%]">
              <div
                className={`rounded-card px-3 py-2 text-sm ${
                  turn.role === 'user'
                    ? 'bg-overlay text-ink shadow-e1'
                    : 'border border-line bg-raised text-ink'
                }`}
              >
                {turn.text}
              </div>
              {turn.grade && (
                <div className="mt-1 flex flex-wrap items-center justify-end gap-1.5">
                  <span
                    className={`rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${TONE_CLASS[intensityLevel(turn.grade.intensity)]}`}
                  >
                    {turn.grade.tone} · {turn.grade.intensity}
                  </span>
                  {turn.grade.hint && (
                    <span className="text-[10px] text-ink-muted">
                      {copy.coachLabel}: {turn.grade.hint}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {state.inFlight && (
          <div className="flex justify-start" aria-label="typing">
            <div className="rounded-card border border-line bg-raised px-3 py-2">
              <span className="inline-flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="rm-static h-1.5 w-1.5 animate-bounce rounded-full bg-ink-muted"
                    style={{ animationDelay: `${i * 150}ms` }}
                  />
                ))}
              </span>
            </div>
          </div>
        )}
      </div>

      {state.apiDown && <p className="mt-2 text-xs text-ink-muted">{copy.apiDown}</p>}

      {/* input or scorecard */}
      {!ended ? (
        <form onSubmit={submit} className="mt-3 flex items-center gap-2">
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
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={copy.inputPlaceholder}
            maxLength={300}
            className="min-w-0 flex-1 rounded-field border border-line bg-raised px-4 py-3 text-sm text-ink placeholder:text-ink-muted focus:border-brand focus:outline-none"
          />
          <button
            type="submit"
            disabled={state.inFlight || input.trim().length === 0}
            className="rounded-full bg-accent-fill px-5 py-3 text-sm font-semibold text-on-accent shadow-e1 transition enabled:hover:brightness-110 disabled:opacity-40"
          >
            {copy.send}
          </button>
        </form>
      ) : (
        <section className="mt-3 rounded-sheet border border-line bg-raised/90 p-5 shadow-e2">
          <p className="text-sm font-semibold text-ink">
            {state.phase === 'won'
              ? copy.winLine(personaCopy.name)
              : state.phase === 'lost-stormed'
                ? copy.lossStormed
                : copy.lossCap}
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-ink-muted">
            <dt>{copy.scorecard.exitMood}</dt>
            <dd className="text-right text-ink">
              <span aria-hidden>{moodWeather(state.mood)}</span> {state.mood}/100
            </dd>
            <dt>{copy.scorecard.calmStreak}</dt>
            <dd className="text-right tabular-nums text-ink">{state.bestCalmStreak}</dd>
            <dt>{copy.scorecard.slips}</dt>
            <dd className="text-right tabular-nums text-ink">
              {state.slips.length === 0 ? copy.scorecard.noSlips : state.slips.length}
            </dd>
          </dl>
          {worstSlip && (
            <p className="mt-3 border-l-2 border-tone-hostile pl-2 text-xs text-ink-secondary">
              {copy.scorecard.worstSlip}: “{worstSlip.quote}”
            </p>
          )}
          <p className="mt-3 border-l-2 border-brand pl-2 text-xs text-ink-secondary">
            {copy.scorecard.whatWorked}:{' '}
            {bestCalmTurn ? `“${bestCalmTurn.text}”` : copy.scorecard.noCalmTurn}
          </p>
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              className="rounded-full bg-accent-fill px-6 py-2.5 text-sm font-semibold text-on-accent shadow-e1 hover:brightness-110"
              onClick={onRematch}
            >
              {copy.rematch}
            </button>
            <button
              type="button"
              className="rounded-full border border-line-strong bg-raised px-6 py-2.5 text-sm font-semibold text-ink-secondary hover:text-ink"
              onClick={onExit}
            >
              {copy.pickAnother}
            </button>
          </div>
        </section>
      )}
    </div>
  )
}

export default function SparringPage() {
  const copy = useSparringT()
  const [persona, setPersona] = useState<PersonaConfig | null>(null)
  const [roundKey, setRoundKey] = useState(0)

  return (
    <div className="min-h-screen text-ink">
      <Aurora />
      <div className="mx-auto w-full max-w-md px-4 pb-16 pt-6">
        <nav className="mb-5 flex items-center justify-between">
          <Link href="/app" className="text-sm font-semibold text-brand hover:brightness-110">
            ← {copy.back}
          </Link>
          <ThemeToggle ariaLabel={copy.themeToggle} />
        </nav>

        {persona === null ? (
          <>
            <h1 className="font-display text-3xl font-bold tracking-tight">{copy.title}</h1>
            <p className="mt-2 text-sm text-ink-secondary">{copy.subtitle}</p>
            {([1, 2, 3] as const).map((tier) => (
              <section key={tier} className="mt-6">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  {copy.tiers[tier]}
                </p>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  {PERSONAS.filter((p) => p.tier === tier).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setPersona(p)
                        setRoundKey((k) => k + 1)
                      }}
                      className="rounded-card border border-line bg-raised/80 p-4 text-left shadow-e1 transition hover:border-brand/50 hover:shadow-e2"
                    >
                      <p className="text-2xl" aria-hidden>
                        {p.emoji}
                      </p>
                      <p className="mt-2 text-sm font-semibold text-ink">
                        {copy.personas[p.id].name}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                        {copy.personas[p.id].bio}
                      </p>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </>
        ) : (
          <Round
            key={`${persona.id}-${roundKey}`}
            persona={persona}
            onExit={() => setPersona(null)}
            onRematch={() => setRoundKey((k) => k + 1)}
          />
        )}
      </div>
    </div>
  )
}
