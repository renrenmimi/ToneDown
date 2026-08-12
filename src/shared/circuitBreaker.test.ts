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
    expect(breaker.beginAttempt(T0 + 30_000)).toBe(true)
    expect(breaker.state).toBe('half-open')
    // Second concurrent attempt while half-open is rejected.
    expect(breaker.beginAttempt(T0 + 30_001)).toBe(false)
  })

  // Regression: canAttempt() used to perform the open -> half-open transition,
  // so a caller that pre-flighted and then bailed out (rate pacing, too-short
  // text) stranded the breaker half-open forever. Worse, callers that DID go on
  // to call were rejected by client.call()'s own guard, because the pre-flight
  // had already consumed the transition — the endpoint could never recover.
  it('canAttempt is a pure query and never consumes the probe slot', () => {
    const breaker = new CircuitBreaker({ failureThreshold: 1, initialBackoffMs: 30_000 })
    breaker.recordFailure(T0)

    const elapsed = T0 + 30_000
    expect(breaker.canAttempt(elapsed)).toBe(true)
    expect(breaker.state).toBe('open') // still open: nothing was reserved
    // Any number of queries stays answerable, and the real attempt still wins.
    expect(breaker.canAttempt(elapsed)).toBe(true)
    expect(breaker.beginAttempt(elapsed)).toBe(true)
    expect(breaker.state).toBe('half-open')
  })

  it('a caller that pre-flights but never issues leaves the breaker recoverable', () => {
    const breaker = new CircuitBreaker({ failureThreshold: 1, initialBackoffMs: 30_000 })
    breaker.recordFailure(T0)

    breaker.canAttempt(T0 + 30_000) // pre-flight, then the caller returns early
    // Ten minutes later the endpoint must still be probeable.
    expect(breaker.canAttempt(T0 + 30_000 + 600_000)).toBe(true)
    expect(breaker.beginAttempt(T0 + 30_000 + 600_000)).toBe(true)
  })

  it('failed probe doubles the backoff, capped at maxBackoffMs', () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 1,
      initialBackoffMs: 30_000,
      maxBackoffMs: 100_000,
    })
    breaker.recordFailure(T0) // open, backoff 30s
    expect(breaker.beginAttempt(T0 + 30_000)).toBe(true) // half-open probe
    breaker.recordFailure(T0 + 30_000) // probe failed -> backoff 60s
    expect(breaker.canAttempt(T0 + 30_000 + 59_999)).toBe(false)
    expect(breaker.canAttempt(T0 + 30_000 + 60_000)).toBe(true)
    breaker.beginAttempt(T0 + 30_000 + 60_000)
    breaker.recordFailure(T0 + 90_000) // -> 120s but capped at 100s
    expect(breaker.msUntilProbe(T0 + 90_000)).toBe(100_000)
  })

  it('success closes the circuit and resets failures and backoff', () => {
    const breaker = new CircuitBreaker({ failureThreshold: 2, initialBackoffMs: 30_000 })
    breaker.recordFailure(T0)
    breaker.recordFailure(T0)
    expect(breaker.state).toBe('open')
    breaker.beginAttempt(T0 + 30_000)
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
