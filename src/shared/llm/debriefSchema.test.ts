import { describe, expect, it } from 'vitest'
// Vitest is not under nodenext pressure, so importing the server schema
// directly here is safe — this test exists precisely to catch drift between
// the server zod schema and the client guard without sharing runtime code.
import { debriefResponseSchema, parseDebriefJson } from '../../../api/_lib/schemas.js'
import { parseDebriefResponse } from './validators'

const VALID = {
  summary: 'You kept it mostly calm and recovered well after one spike.',
  emotional_arc: 'Calm start, one mid-session spike, calm landing.',
  trigger_moments: [
    {
      quote: 'you never listen to me',
      why_it_escalated: 'Absolute accusations put the listener on the defensive.',
      better_phrasing: "I don't feel heard right now — can I finish this thought?",
    },
  ],
  one_habit_to_practice: 'Swap "you always/never" for one concrete recent example.',
}

const INVALID_CASES: unknown[] = [
  null,
  {},
  { ...VALID, summary: 42 },
  { ...VALID, trigger_moments: [{ quote: 'x' }] },
  { ...VALID, one_habit_to_practice: undefined },
]

describe('debrief schema drift guard (client guard vs server zod)', () => {
  it('both sides accept the canonical fixture', () => {
    expect(parseDebriefResponse(VALID)).not.toBeNull()
    expect(debriefResponseSchema.safeParse(VALID).success).toBe(true)
  })

  it.each(INVALID_CASES.map((c, i) => [i, c] as const))(
    'both sides reject invalid case %i',
    (_, bad) => {
      expect(parseDebriefResponse(bad)).toBeNull()
      expect(debriefResponseSchema.safeParse(bad).success).toBe(false)
    },
  )

  it('server-side parseDebriefJson strips code fences and validates', () => {
    const fenced = '```json\n' + JSON.stringify(VALID) + '\n```'
    expect(parseDebriefJson(fenced)).toEqual(debriefResponseSchema.parse(VALID))
    expect(parseDebriefJson('not json at all')).toBeNull()
  })

  it('zod caps trigger_moments at 3 (client slices, server rejects >3 consistently)', () => {
    const four = { ...VALID, trigger_moments: Array(4).fill(VALID.trigger_moments[0]) }
    // Client guard tolerates by slicing; server schema rejects — the route's
    // corrective retry handles it. Pin both behaviors explicitly.
    expect(parseDebriefResponse(four)?.trigger_moments).toHaveLength(3)
    expect(debriefResponseSchema.safeParse(four).success).toBe(false)
  })
})
