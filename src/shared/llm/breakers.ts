import { CircuitBreaker } from '@/shared/circuitBreaker'

// One named breaker per API route group, module-scoped so a flapping
// endpoint stays backed off across component remounts and sessions.

export type BreakerName = 'transcribe' | 'analyze' | 'rewrite' | 'debrief' | 'sparring' | 'gym'

const registry = new Map<BreakerName, CircuitBreaker>()

export function getBreaker(name: BreakerName): CircuitBreaker {
  let breaker = registry.get(name)
  if (!breaker) {
    breaker = new CircuitBreaker()
    registry.set(name, breaker)
  }
  return breaker
}

/** Test-only: drop all breaker state. */
export function resetBreakersForTest(): void {
  registry.clear()
}
