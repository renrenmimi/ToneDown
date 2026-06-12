import { createMachineStore } from '@/shared/state/machine'
import { createSignal } from '@/shared/state/signalBus'
import type { LlmToneResult, SpeedLevel } from '@/types/app'
import { EMOTION_META, type FusionMode } from '../lib/fusion'
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

/**
 * Per-tick fusion byproducts the UI wants but the machine doesn't need for
 * control flow (keyword chips, wpm, fusion mode, the LLM tone line).
 */
export interface FusionFrame {
  wordsPerMinute: number
  speedLevel: SpeedLevel
  emotionColor: string
  highRiskKeywords: string[]
  mediumRiskKeywords: string[]
  latestHighRiskKeyword: string | null
  fusionMode: FusionMode
  llmTone: LlmToneResult | null
}

export const initialFusionFrame: FusionFrame = {
  wordsPerMinute: 0,
  speedLevel: 'normal',
  emotionColor: EMOTION_META.calm.color,
  highRiskKeywords: [],
  mediumRiskKeywords: [],
  latestHighRiskKeyword: null,
  fusionMode: 'rules',
  llmTone: null,
}

export const fusionSignal = createSignal<FusionFrame>(initialFusionFrame)
