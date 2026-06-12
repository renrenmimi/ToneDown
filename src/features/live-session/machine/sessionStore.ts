import { createMachineStore } from '@/shared/state/machine'
import { createSignal } from '@/shared/state/signalBus'
import {
  createInitialSessionState,
  sessionReducer,
  type SessionEffect,
  type SessionEvent,
  type SessionState,
} from './sessionMachine'

// Module-scoped store: services dispatch from MediaRecorder/timer callbacks
// without ref-mirroring, and the demo script player can drive it from plain
// TS. Session lifecycle resets happen via START_REQUESTED, so surviving
// React remounts (StrictMode) is a feature, not a leak.
export const sessionStore = createMachineStore<SessionState, SessionEvent, SessionEffect>(
  sessionReducer,
  createInitialSessionState(),
)

// High-frequency mic RMS (100ms) bypasses the machine entirely; the fusion
// ticker samples it at the 2s cadence and dispatches one SCORE_UPDATED.
export const volumeSignal = createSignal(0)
