import { describe, expect, it } from 'vitest'
import { parseSparringJson, sparringResponseSchema } from '../../../api/_lib/schemas.js'
import { parseSparringResponse } from './validators'

const VALID = {
  reply: "Fine. FINE. But this is the last time I wait for corporate to 'look into it'.",
  user_tone: 'neutral',
  intensity: 22,
  constructive: true,
  coach_hint: 'Nice acknowledgement — keep offering one concrete next step.',
}

const INVALID: unknown[] = [
  null,
  { ...VALID, reply: '' },
  { ...VALID, user_tone: 'furious' },
  { ...VALID, intensity: 'high' },
  { ...VALID, constructive: 'yes' },
]

describe('sparring schema drift guard (client guard vs server zod)', () => {
  it('both sides accept the canonical fixture', () => {
    expect(parseSparringResponse(VALID)).not.toBeNull()
    expect(sparringResponseSchema.safeParse(VALID).success).toBe(true)
  })

  it.each(INVALID.map((c, i) => [i, c] as const))('both sides reject invalid case %i', (_, bad) => {
    expect(parseSparringResponse(bad)).toBeNull()
    expect(sparringResponseSchema.safeParse(bad).success).toBe(false)
  })

  it('server parse clamps intensity and strips fences', () => {
    const fenced = '```json\n' + JSON.stringify({ ...VALID, intensity: 250 }) + '\n```'
    expect(parseSparringJson(fenced)?.intensity).toBe(100)
  })
})
