// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEndpoint } from './client'
import { getBreaker, resetBreakersForTest } from './breakers'
import { resetBudgetForTest } from './budget'

// End-to-end recovery through the real client: the unit tests around
// CircuitBreaker pass with the class in isolation, but the endpoint could still
// never recover because the pre-flight check and call() both consulted it.

interface Res {
  ok: boolean
  status: number
  headers: { get: () => null }
  json: () => Promise<unknown>
}

const okResponse = (): Res => ({
  ok: true,
  status: 200,
  headers: { get: () => null },
  json: () => Promise.resolve({ value: 'good' }),
})

const failResponse = (): Res => ({
  ok: false,
  status: 500,
  headers: { get: () => null },
  json: () => Promise.resolve(null),
})

const makeEndpoint = () =>
  createEndpoint<{ n: number }, { value: string }>({
    path: '/api/analyze',
    timeoutMs: 1_000,
    breaker: 'analyze',
    feature: 'live-analyze',
    latencyStage: 'analyze',
    estimateTokens: () => 1,
    encode: () => ({ body: '{}', headers: {} }),
    validate: (data) =>
      typeof data === 'object' && data !== null && 'value' in data
        ? (data as { value: string })
        : null,
  })

beforeEach(() => {
  resetBreakersForTest()
  resetBudgetForTest()
  localStorage.clear()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('endpoint recovery after the breaker opens', () => {
  it('recovers on the first successful probe once the backoff elapses', async () => {
    const fetchMock = vi.fn<() => Promise<Res>>().mockResolvedValue(failResponse())
    vi.stubGlobal('fetch', fetchMock)
    const endpoint = makeEndpoint()

    // Three consecutive failures open the breaker.
    for (let i = 0; i < 3; i += 1) {
      await expect(endpoint.call({ n: i })).rejects.toThrow()
    }
    expect(getBreaker('analyze').state).toBe('open')
    expect(endpoint.canAttempt()).toBe(false)

    // Backoff elapses.
    vi.advanceTimersByTime(30_000)

    // A caller pre-flights and then decides NOT to call (pacing / short text).
    expect(endpoint.canAttempt()).toBe(true)

    // The next caller must still get through and close the circuit.
    fetchMock.mockResolvedValue(okResponse())
    expect(endpoint.canAttempt()).toBe(true)
    await expect(endpoint.call({ n: 99 })).resolves.toEqual({ value: 'good' })
    expect(getBreaker('analyze').state).toBe('closed')
    expect(endpoint.canAttempt()).toBe(true)
  })

  it('a bailed-out pre-flight does not strand the endpoint', async () => {
    const fetchMock = vi.fn<() => Promise<Res>>().mockResolvedValue(failResponse())
    vi.stubGlobal('fetch', fetchMock)
    const endpoint = makeEndpoint()

    for (let i = 0; i < 3; i += 1) {
      await expect(endpoint.call({ n: i })).rejects.toThrow()
    }

    vi.advanceTimersByTime(30_000)
    // Pre-flight repeatedly without ever calling — the historical failure mode.
    for (let i = 0; i < 5; i += 1) {
      endpoint.canAttempt()
    }
    vi.advanceTimersByTime(600_000)

    fetchMock.mockResolvedValue(okResponse())
    await expect(endpoint.call({ n: 1 })).resolves.toEqual({ value: 'good' })
    expect(getBreaker('analyze').state).toBe('closed')
  })
})
