// Tiny observable for high-frequency values (100ms mic RMS) that would be
// wasteful to route through the state machine or React state. The fusion
// ticker reads the signal at its own 2s cadence; the gauge (M1) subscribes
// directly and writes to the DOM via refs.

export interface Signal<T> {
  get(): T
  set(value: T): void
  subscribe(listener: (value: T) => void): () => void
}

export function createSignal<T>(initial: T): Signal<T> {
  let current = initial
  const listeners = new Set<(value: T) => void>()

  return {
    get: () => current,
    set(value: T) {
      current = value
      for (const listener of listeners) {
        listener(value)
      }
    },
    subscribe(listener: (value: T) => void) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
