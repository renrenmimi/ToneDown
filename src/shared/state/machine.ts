import { useSyncExternalStore } from 'react'

// Generic ~80-line typed state-machine runner. Chosen over XState
// deliberately: the session machine has 6 phases and ~14 events — fully
// expressible as a pure (state, event) -> {state, effects} reducer with
// inferred types. Owning the runner is also what makes demo mode trivial
// (dispatch from plain TS, fake clocks), and keeps effects as DATA the
// reducer returns rather than side effects hidden in components.

export interface Reduction<S, Fx> {
  state: S
  effects?: Fx[]
}

export type MachineReducer<S, E, Fx> = (state: S, event: E) => Reduction<S, Fx>

export interface MachineStore<S, E, Fx> {
  getState(): S
  dispatch(event: E): void
  subscribe(listener: () => void): () => void
  /** Register an effect executor. Effects are delivered synchronously after the state commit. */
  onEffect(handler: (effect: Fx) => void): () => void
  /** Test/demo support: replace state wholesale (e.g. reset between runs). */
  replaceState(state: S): void
}

export function createMachineStore<S, E, Fx>(
  reducer: MachineReducer<S, E, Fx>,
  initial: S,
): MachineStore<S, E, Fx> {
  let state = initial
  const listeners = new Set<() => void>()
  const effectHandlers = new Set<(effect: Fx) => void>()

  return {
    getState: () => state,

    dispatch(event: E): void {
      const result = reducer(state, event)
      const changed = result.state !== state
      state = result.state
      if (changed) {
        for (const listener of listeners) {
          listener()
        }
      }
      if (result.effects) {
        for (const effect of result.effects) {
          for (const handler of effectHandlers) {
            handler(effect)
          }
        }
      }
    },

    subscribe(listener: () => void): () => void {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },

    onEffect(handler: (effect: Fx) => void): () => void {
      effectHandlers.add(handler)
      return () => effectHandlers.delete(handler)
    },

    replaceState(next: S): void {
      state = next
      for (const listener of listeners) {
        listener()
      }
    },
  }
}

/**
 * Selector subscription. Selectors must return a state field or primitive
 * (reducers preserve references for untouched fields), so Object.is on the
 * snapshot prevents unrelated events from re-rendering consumers.
 */
export function useStoreSelector<S, E, Fx, T>(
  store: MachineStore<S, E, Fx>,
  selector: (state: S) => T,
): T {
  return useSyncExternalStore(store.subscribe, () => selector(store.getState()))
}
