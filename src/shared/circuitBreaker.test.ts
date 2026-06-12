import { describe, expect, it } from 'vitest'
import { CircuitBreaker } from './circuitBreaker'

const T0 = 1_000_000

describe('CircuitBreaker', () => {
  it('starts closed and allows attempts', () => {
    const breaker = new CircuitBreaker()
    expect(breaker.state).toBe('closed')
    expect(breaker.canAttempt(T0)).toBe(true)
  })

  it('opens after the failure threshold and blocks attempts during backoff', () => {
    const breaker = new CircuitBreaker({ failureThreshold: 3, initialBackoffMs: 30_000 })
    breaker.recordFailure(T0)
    breaker.recordFailure(T0)
    expect(breaker.state).toBe('closed')
    breaker.recordFailure(T0)
    expect(breaker.state).toBe('open')
    expect(breaker.canAttempt(T0 + 29_999)).toBe(false)
  })

  it('transitions to half-open after backoff and admits exactly one probe', () => {
    const breaker = new CircuitBreaker({ failureThreshold: 1, initialBackoffMs: 30_000 })
    breaker.recordFailure(T0)
    expect(breaker.canAttempt(T0 + 30_000)).toBe(true)
    expect(breaker.state).toBe('half-open')
    // Second concurrent attempt while half-open is rejected.
    expect(breaker.canAttempt(T0 + 30_001)).toBe(false)
  })

  it('failed probe doubles the backoff, capped at maxBackoffMs', () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 1,
      initialBackoffMs: 30_000,
      maxBackoffMs: 100_000,
    })
    breaker.recordFailure(T0) // open, backoff 30s
    expect(breaker.canAttempt(T0 + 30_000)).toBe(true) // half-open probe
    breaker.recordFailure(T0 + 30_000) // probe failed -> backoff 60s
    expect(breaker.canAttempt(T0 + 30_000 + 59_999)).toBe(false)
    expect(breaker.canAttempt(T0 + 30_000 + 60_000)).toBe(true)
    breaker.recordFailure(T0 + 90_000) // -> 120s but capped at 100s
    expect(breaker.msUntilProbe(T0 + 90_000)).toBe(100_000)
  })

  it('success closes the circuit and resets failures and backoff', () => {
    const breaker = new CircuitBreaker({ failureThreshold: 2, initialBackoffMs: 30_000 })
    breaker.recordFailure(T0)
    breaker.recordFailure(T0)
    expect(breaker.state).toBe('open')
    breaker.canAttempt(T0 + 30_000)
    breaker.recordSuccess()
    expect(breaker.state).toBe('closed')
    // Threshold counts from zero again.
    breaker.recordFailure(T0 + 60_000)
    expect(breaker.state).toBe('closed')
  })

  it('msUntilProbe reports zero when closed', () => {
    const breaker = new CircuitBreaker()
    expect(breaker.msUntilProbe(T0)).toBe(0)
  })
})
