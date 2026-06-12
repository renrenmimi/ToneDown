import { describe, expect, it } from 'vitest'
import {
  createInitialSessionState,
  DEESCALATE_SCORE,
  ESCALATE_SCORE,
  ESCALATION_SUSTAIN_MS,
  INTERVENTION_COOLDOWN_MS,
  INTERVENTION_DURATION_MS,
  MAX_TRANSCRIPT_ENTRIES,
  sessionReducer,
  type SessionEffect,
  type SessionEvent,
  type SessionState,
} from './sessionMachine'

const T0 = 1_750_000_000_000

interface Run {
  state: SessionState
  effects: SessionEffect[]
}

function run(events: SessionEvent[], from?: SessionState): Run {
  let state = from ?? createInitialSessionState()
  const effects: SessionEffect[] = []
  for (const event of events) {
    const result = sessionReducer(state, event)
    state = result.state
    effects.push(...(result.effects ?? []))
  }
  return { state, effects }
}

const startToListening: SessionEvent[] = [
  { type: 'START_REQUESTED' },
  { type: 'MIC_READY', at: T0 },
  { type: 'CALIBRATION_COMPLETE', at: T0 },
]

const score = (value: number, at: number): SessionEvent => ({
  type: 'SCORE_UPDATED',
  score: value,
  level: value <= 30 ? 'calm' : value <= 55 ? 'elevated' : value <= 75 ? 'heated' : 'critical',
  at,
})

describe('session start', () => {
  it('idle -> calibrating with acquireMic effect, then listening', () => {
    const afterStart = run([{ type: 'START_REQUESTED' }])
    expect(afterStart.state.phase).toBe('calibrating')
    expect(afterStart.effects).toEqual([{ kind: 'acquireMic' }])

    const { state } = run(startToListening)
    expect(state.phase).toBe('listening')
    expect(state.startedAt).toBe(T0)
  })

  it('mic denial returns to idle with the error and releases the mic', () => {
    const { state, effects } = run([
      { type: 'START_REQUESTED' },
      { type: 'MIC_DENIED', reason: 'MIC_PERMISSION_DENIED' },
    ])
    expect(state.phase).toBe('idle')
    expect(state.error).toBe('MIC_PERMISSION_DENIED')
    expect(effects).toContainEqual({ kind: 'releaseMic' })
  })

  it('START_REQUESTED resets per-session context but keeps engine status', () => {
    const prev = run([
      ...startToListening,
      { type: 'STT_ENGINE_CHANGED', engine: 'browser' },
      { type: 'STOP_REQUESTED', at: T0 + 10_000 },
      { type: 'RECAP_CLOSED' },
    ]).state
    const { state } = run([{ type: 'START_REQUESTED' }], prev)
    expect(state.transcript).toHaveLength(0)
    expect(state.engines.stt).toBe('browser')
  })
})

describe('escalation with hysteresis', () => {
  it('listening -> escalated at score >= 70', () => {
    const { state } = run([...startToListening, score(72, T0 + 2_000)])
    expect(state.phase).toBe('escalated')
    expect(state.escalatedSince).toBe(T0 + 2_000)
  })

  it(`a dip to ${DEESCALATE_SCORE + 4} does NOT de-escalate (hysteresis band)`, () => {
    const { state } = run([
      ...startToListening,
      score(72, T0 + 2_000),
      score(DEESCALATE_SCORE + 4, T0 + 4_000),
    ])
    expect(state.phase).toBe('escalated')
  })

  it(`a drop below ${DEESCALATE_SCORE} de-escalates and clears the sustain timer`, () => {
    const { state } = run([
      ...startToListening,
      score(72, T0 + 2_000),
      score(DEESCALATE_SCORE - 1, T0 + 4_000),
    ])
    expect(state.phase).toBe('listening')
    expect(state.escalatedSince).toBeNull()
  })
})

describe('intervention trigger (score >= 70 held 5s)', () => {
  it('fires via TICK once sustained', () => {
    const start = T0 + 2_000
    const { state } = run([
      ...startToListening,
      score(80, start),
      { type: 'TICK', at: start + ESCALATION_SUSTAIN_MS - 1 },
      { type: 'TICK', at: start + ESCALATION_SUSTAIN_MS },
    ])
    expect(state.phase).toBe('intervention')
    expect(state.interventionEndsAt).toBe(start + ESCALATION_SUSTAIN_MS + INTERVENTION_DURATION_MS)
    expect(state.interventionCount).toBe(1)
  })

  it('does not fire before 5s', () => {
    const start = T0 + 2_000
    const { state } = run([
      ...startToListening,
      score(80, start),
      { type: 'TICK', at: start + ESCALATION_SUSTAIN_MS - 1 },
    ])
    expect(state.phase).toBe('escalated')
  })

  it('acknowledgement returns to listening and starts the 60s cooldown', () => {
    const start = T0 + 2_000
    const ackAt = start + ESCALATION_SUSTAIN_MS + 3_000
    const { state } = run([
      ...startToListening,
      score(80, start),
      { type: 'TICK', at: start + ESCALATION_SUSTAIN_MS },
      { type: 'INTERVENTION_ACKNOWLEDGED', at: ackAt },
    ])
    expect(state.phase).toBe('listening')
    expect(state.interventionCooldownUntil).toBe(ackAt + INTERVENTION_COOLDOWN_MS)
  })

  it('auto-dismisses after the 30s breathing window', () => {
    const start = T0 + 2_000
    const enteredAt = start + ESCALATION_SUSTAIN_MS
    const { state } = run([
      ...startToListening,
      score(80, start),
      { type: 'TICK', at: enteredAt },
      { type: 'TICK', at: enteredAt + INTERVENTION_DURATION_MS },
    ])
    expect(state.phase).toBe('listening')
  })

  it('cooldown blocks a re-trigger; sustain counts from cooldown end', () => {
    const start = T0 + 2_000
    const enteredAt = start + ESCALATION_SUSTAIN_MS
    const ackAt = enteredAt + 1_000
    const cooldownEnd = ackAt + INTERVENTION_COOLDOWN_MS

    const base = [
      ...startToListening,
      score(80, start),
      { type: 'TICK', at: enteredAt } as SessionEvent,
      { type: 'INTERVENTION_ACKNOWLEDGED', at: ackAt } as SessionEvent,
      // Still hostile right through the cooldown.
      score(85, ackAt + 2_000),
    ]

    // During cooldown: even long-sustained hostility must not re-trigger.
    const during = run([...base, { type: 'TICK', at: cooldownEnd - 1 }])
    expect(during.state.phase).toBe('escalated')

    // After cooldown: needs 5s sustained from the cooldown end, not before.
    const tooSoon = run([...base, { type: 'TICK', at: cooldownEnd + ESCALATION_SUSTAIN_MS - 1 }])
    expect(tooSoon.state.phase).toBe('escalated')

    const fires = run([...base, { type: 'TICK', at: cooldownEnd + ESCALATION_SUSTAIN_MS }])
    expect(fires.state.phase).toBe('intervention')
  })
})

describe('stop and recap', () => {
  it.each(['calibrating', 'listening', 'escalated', 'intervention'] as const)(
    'STOP from %s reaches recap with releaseMic + persist + debrief effects',
    (phase) => {
      const setups: Record<typeof phase, SessionEvent[]> = {
        calibrating: [{ type: 'START_REQUESTED' }],
        listening: startToListening,
        escalated: [...startToListening, score(80, T0 + 2_000)],
        intervention: [
          ...startToListening,
          score(80, T0 + 2_000),
          { type: 'TICK', at: T0 + 2_000 + ESCALATION_SUSTAIN_MS },
        ],
      }
      const { state, effects } = run([
        ...setups[phase],
        { type: 'STOP_REQUESTED', at: T0 + 60_000 },
      ])
      expect(state.phase).toBe('recap')
      expect(effects).toContainEqual({ kind: 'releaseMic' })
      expect(effects).toContainEqual({ kind: 'persistSession' })
      expect(effects).toContainEqual({ kind: 'requestDebrief' })
    },
  )

  it('recap -> idle on RECAP_CLOSED', () => {
    const { state } = run([
      ...startToListening,
      { type: 'STOP_REQUESTED', at: T0 + 60_000 },
      { type: 'RECAP_CLOSED' },
    ])
    expect(state.phase).toBe('idle')
  })
})

describe('orthogonal engine state', () => {
  it.each(['idle', 'listening', 'intervention'] as const)(
    'engine events update context without changing phase (%s)',
    (phase) => {
      const setups: Record<typeof phase, SessionEvent[]> = {
        idle: [],
        listening: startToListening,
        intervention: [
          ...startToListening,
          score(80, T0 + 2_000),
          { type: 'TICK', at: T0 + 2_000 + ESCALATION_SUSTAIN_MS },
        ],
      }
      const { state } = run([
        ...setups[phase],
        { type: 'STT_ENGINE_CHANGED', engine: 'browser' },
        { type: 'ANALYSIS_MODE_CHANGED', mode: 'rules' },
      ])
      expect(state.phase).toBe(phase)
      expect(state.engines).toEqual({ stt: 'browser', analysis: 'rules' })
    },
  )

  it('returns the same state reference when engine status is unchanged', () => {
    const initial = createInitialSessionState()
    const result = sessionReducer(initial, { type: 'STT_ENGINE_CHANGED', engine: 'groq' })
    expect(result.state).toBe(initial)
  })
})

describe('transcript flow', () => {
  it('appends finalized entries during active phases and caps at 600', () => {
    const entries = Array.from({ length: MAX_TRANSCRIPT_ENTRIES + 10 }, (_, i) => ({
      text: `line ${i}`,
      timestamp: T0 + i,
    }))
    const { state } = run([
      ...startToListening,
      { type: 'TRANSCRIPT_FINALIZED', entries },
    ])
    expect(state.transcript).toHaveLength(MAX_TRANSCRIPT_ENTRIES)
    expect(state.transcript[0].text).toBe('line 10')
  })

  it('ignores transcript events while idle', () => {
    const { state } = run([
      { type: 'TRANSCRIPT_FINALIZED', entries: [{ text: 'x', timestamp: T0 }] },
    ])
    expect(state.transcript).toHaveLength(0)
  })

  it('escalation threshold matches the exported constant', () => {
    const below = run([...startToListening, score(ESCALATE_SCORE - 1, T0 + 2_000)])
    const at = run([...startToListening, score(ESCALATE_SCORE, T0 + 2_000)])
    expect(below.state.phase).toBe('listening')
    expect(at.state.phase).toBe('escalated')
  })
})
