import { useStoreSelector } from '@/shared/state/machine'
import { sessionStore } from './sessionStore'
import type { SessionState } from './sessionMachine'

// Selector hooks: each subscribes to exactly one state field, so a 2s score
// tick doesn't re-render transcript consumers and vice versa. Selectors
// must return state fields or primitives (reducer preserves references for
// untouched fields).

export function useSession<T>(selector: (state: SessionState) => T): T {
  return useStoreSelector(sessionStore, selector)
}

export const useSessionPhase = () => useSession((s) => s.phase)
export const useSessionScore = () => useSession((s) => s.score)
export const useEmotionLevel = () => useSession((s) => s.emotionLevel)
export const useScoreHistory = () => useSession((s) => s.scoreHistory)
export const useTranscript = () => useSession((s) => s.transcript)
export const useInterim = () => useSession((s) => s.interim)
export const useEngines = () => useSession((s) => s.engines)
export const useSessionError = () => useSession((s) => s.error)
export const useIsSessionActive = () =>
  useSession((s) => s.phase !== 'idle' && s.phase !== 'recap')
