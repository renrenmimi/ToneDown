export type CircuitState = 'closed' | 'open' | 'half-open'

interface CircuitBreakerOptions {
  failureThreshold?: number
  initialBackoffMs?: number
  maxBackoffMs?: number
}

/**
 * Classic three-state circuit breaker guarding each API endpoint group:
 * closed (normal) → open after N consecutive failures (all calls skipped,
 * exponential backoff 30s → 5min) → half-open lets exactly one probe through
 * → success closes the circuit, failure reopens it with a doubled backoff.
 * Keeps a degraded LLM endpoint from being hammered while the local rules
 * engine carries the app.
 */
export class CircuitBreaker {
  private failures = 0
  private currentState: CircuitState = 'closed'
  private backoffMs: number
  private nextProbeAt = 0

  private readonly failureThreshold: number
  private readonly initialBackoffMs: number
  private readonly maxBackoffMs: number

  constructor({
    failureThreshold = 3,
    initialBackoffMs = 30_000,
    maxBackoffMs = 300_000,
  }: CircuitBreakerOptions = {}) {
    this.failureThreshold = failureThreshold
    this.initialBackoffMs = initialBackoffMs
    this.maxBackoffMs = maxBackoffMs
    this.backoffMs = initialBackoffMs
  }

  get state(): CircuitState {
    return this.currentState
  }

  /**
   * Pure query: may a request be issued right now?
   *
   * Deliberately side-effect free. Callers pre-flight with this ("is it even
   * worth assembling a request?") and only some of them go on to issue one —
   * if the query itself burned the half-open transition, a caller that bailed
   * out afterwards would strand the breaker half-open with no probe in flight,
   * and nothing would ever close it again. Reserving the slot is beginAttempt's
   * job.
   */
  canAttempt(now: number = Date.now()): boolean {
    if (this.currentState === 'closed') {
      return true
    }
    if (this.currentState === 'half-open') {
      // A probe is already in flight; it alone decides the next transition.
      return false
    }
    return now >= this.nextProbeAt
  }

  /**
   * Reserve the attempt slot for a request that is actually being issued now,
   * moving an elapsed open circuit to half-open. The caller MUST then reach
   * recordSuccess() or recordFailure() on every path — a reserved probe that
   * never reports back leaves the breaker half-open indefinitely.
   */
  beginAttempt(now: number = Date.now()): boolean {
    if (!this.canAttempt(now)) {
      return false
    }
    if (this.currentState === 'open') {
      this.currentState = 'half-open'
    }
    return true
  }

  recordSuccess(): void {
    this.failures = 0
    this.backoffMs = this.initialBackoffMs
    this.currentState = 'closed'
  }

  recordFailure(now: number = Date.now()): void {
    this.failures += 1

    if (this.currentState === 'half-open') {
      // Failed probe: back off harder before the next one.
      this.backoffMs = Math.min(this.backoffMs * 2, this.maxBackoffMs)
      this.open(now)
    } else if (this.currentState === 'closed' && this.failures >= this.failureThreshold) {
      this.open(now)
    }
  }

  /** How long until the next probe is allowed (0 when closed/half-open). */
  msUntilProbe(now: number = Date.now()): number {
    return this.currentState === 'open' ? Math.max(0, this.nextProbeAt - now) : 0
  }

  private open(now: number): void {
    this.currentState = 'open'
    this.nextProbeAt = now + this.backoffMs
  }
}
