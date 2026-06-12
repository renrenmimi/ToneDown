// Clock port: every timer the session uses goes through this interface so
// demo mode (and tests) can substitute a scripted/accelerated clock.

export interface Clock {
  now(): number
  setInterval(fn: () => void, ms: number): () => void
  setTimeout(fn: () => void, ms: number): () => void
}

export const systemClock: Clock = {
  now: () => Date.now(),
  setInterval(fn, ms) {
    const id = window.setInterval(fn, ms)
    return () => window.clearInterval(id)
  },
  setTimeout(fn, ms) {
    const id = window.setTimeout(fn, ms)
    return () => window.clearTimeout(id)
  },
}
