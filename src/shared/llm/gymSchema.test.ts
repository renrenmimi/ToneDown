import { describe, expect, it } from 'vitest'
import { parseGymGradeJson } from '../../../api/_lib/schemas.js'
import { parseGymGradeResponse } from './validators'

const MODEL_OUTPUT = {
  score: 92,
  feedback: 'Good — you named the feeling and asked for something concrete.',
  better_version: "I'm feeling rushed — could you walk me through it once more?",
}

describe('gym-grade schema drift guard', () => {
  it('server derives passed from score; client accepts the wire shape', () => {
    const server = parseGymGradeJson(JSON.stringify(MODEL_OUTPUT))
    expect(server).not.toBeNull()
    expect(server?.passed).toBe(true)
    expect(parseGymGradeResponse(server)).toEqual(server)
  })

  it('89 does not pass; clamping applies', () => {
    expect(parseGymGradeJson(JSON.stringify({ ...MODEL_OUTPUT, score: 89 }))?.passed).toBe(false)
    expect(parseGymGradeJson(JSON.stringify({ ...MODEL_OUTPUT, score: 150 }))?.score).toBe(100)
  })

  it.each([
    { ...MODEL_OUTPUT, score: 'A+' },
    { ...MODEL_OUTPUT, feedback: '' },
    { score: 90 },
  ])('both sides reject %j', (bad) => {
    expect(parseGymGradeJson(JSON.stringify(bad))).toBeNull()
    expect(parseGymGradeResponse(bad)).toBeNull()
  })
})
