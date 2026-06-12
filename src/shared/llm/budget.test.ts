// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import {
  DAILY_REQUEST_CAPS,
  DAILY_TOKEN_BUDGETS,
  getSnapshot,
  precheck,
  record,
  resetBudgetForTest,
  suspend,
} from './budget'

const DAY1_NOON = new Date('2026-06-12T12:00:00').getTime()
const DAY2_NOON = new Date('2026-06-13T12:00:00').getTime()

beforeEach(() => {
  localStorage.clear()
  resetBudgetForTest()
})

describe('budget meter', () => {
  it('accumulates per-feature buckets independently', () => {
    record('live-analyze', 350, {}, DAY1_NOON)
    record('gym', 320, {}, DAY1_NOON)
    expect(getSnapshot('live-analyze', DAY1_NOON).tokensUsed).toBe(350)
    expect(getSnapshot('live-analyze', DAY1_NOON).requestsUsed).toBe(1)
    expect(getSnapshot('gym', DAY1_NOON).tokensUsed).toBe(320)
  })

  it('resets on day rollover', () => {
    record('live-analyze', 350, {}, DAY1_NOON)
    expect(getSnapshot('live-analyze', DAY2_NOON).tokensUsed).toBe(0)
  })

  it('tracks audio seconds for the whisper pool', () => {
    record('live-transcribe', 0, { audioSeconds: 4 }, DAY1_NOON)
    record('live-transcribe', 0, { audioSeconds: 4 }, DAY1_NOON)
    expect(getSnapshot('live-transcribe', DAY1_NOON).requestsUsed).toBe(2)
  })

  it('enforcing mode blocks an exhausted token bucket', () => {
    record('gym', DAILY_TOKEN_BUDGETS.gym, {}, DAY1_NOON)
    const decision = precheck('gym', 1_000, DAY1_NOON)
    expect(decision.allowed).toBe(false)
    expect(decision.reason).toBe('tokens')
    // other buckets are unaffected
    expect(precheck('debrief', 100, DAY1_NOON).allowed).toBe(true)
  })

  it('reports the request-cap reason when requests run out first', () => {
    for (let i = 0; i < DAILY_REQUEST_CAPS.debrief; i += 1) {
      record('debrief', 10, {}, DAY1_NOON)
    }
    const decision = precheck('debrief', 10, DAY1_NOON)
    expect(decision.reason).toBe('requests')
    expect(decision.allowed).toBe(false)
  })

  it('suspend blocks all features for the retry window', () => {
    suspend(60, DAY1_NOON)
    const blocked = precheck('live-analyze', 10, DAY1_NOON + 59_000)
    expect(blocked.reason).toBe('suspended')
    expect(blocked.allowed).toBe(false)
    expect(precheck('live-analyze', 10, DAY1_NOON + 61_000).allowed).toBe(true)
  })

  it('persists across reloads within the same day', () => {
    record('sparring', 700, {}, DAY1_NOON)
    resetBudgetForTest() // simulates a new tab / reload reading from storage
    expect(getSnapshot('sparring', DAY1_NOON + 1_000).tokensUsed).toBe(700)
  })
})
