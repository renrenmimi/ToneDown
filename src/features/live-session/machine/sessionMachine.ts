import type { EmotionHistoryEntry, EmotionLevel, SttEngine, TranscriptEntry } from '@/types/app'
import type { Reduction } from '@/shared/state/machine'

// The session lifecycle as an explicit, pure state machine.
//
// Design rules:
// - ALL timing decisions compare against `event.at` (TICK heartbeat or the
//   triggering event's timestamp) — never Date.now() — so transitions are
//   deterministic in tests and demo mode runs on a scripted clock.
// - Engine status (which STT engine, LLM vs rules scoring) is ORTHOGONAL
//   context updated by wildcard events, not phases: no phase transition
//   depends on it, it just tells the UI the truth.
// - Effects are data returned from the reducer; services execute them.

export type SessionPhase =
  | 'idle'
  | 'calibrating'
  | 'listening'
  | 'escalated'
  | 'intervention'
  | 'recap'

export interface EngineState {
  stt: SttEngine | 'unavailable'
  analysis: 'llm' | 'rules'
}

export type SessionError = 'MIC_PERMISSION_DENIED' | 'MIC_INIT_FAILED' | null

/** A hostile moment the coach flagged: shown as a ribbon marker with the offered rewrite. */
export interface FlaggedMoment {
  at: number
  quote: string
  rewrite: string
}

export interface SessionState {
  phase: SessionPhase
  startedAt: number | null
  endedAt: number | null
  score: number
  emotionLevel: EmotionLevel
  scoreHistory: EmotionHistoryEntry[]
  transcript: TranscriptEntry[]
  interim: string
  /** When the score first crossed the escalation threshold (null when below). */
  escalatedSince: number | null
  interventionEndsAt: number | null
  interventionCooldownUntil: number
  interventionCount: number
  engines: EngineState
  error: SessionError
  flaggedMoments: FlaggedMoment[]
}

export type SessionEvent =
  | { type: 'START_REQUESTED' }
  | { type: 'MIC_READY'; at: number }
  | { type: 'MIC_DENIED'; reason: Exclude<SessionError, null> }
  | { type: 'CALIBRATION_COMPLETE'; at: number }
  | { type: 'TRANSCRIPT_FINALIZED'; entries: TranscriptEntry[] }
  | { type: 'INTERIM_CHANGED'; text: string }
  | { type: 'SCORE_UPDATED'; score: number; level: EmotionLevel; at: number }
  | { type: 'TICK'; at: number }
  | { type: 'INTERVENTION_ACKNOWLEDGED'; at: number }
  | { type: 'STOP_REQUESTED'; at: number }
  | { type: 'RECAP_CLOSED' }
  | { type: 'REWRITE_OFFERED'; moment: FlaggedMoment }
  | { type: 'STT_ENGINE_CHANGED'; engine: EngineState['stt'] }
  | { type: 'ANALYSIS_MODE_CHANGED'; mode: EngineState['analysis'] }

export type SessionEffect =
  | { kind: 'acquireMic' }
  | { kind: 'releaseMic' }
  | { kind: 'persistSession' }
  | { kind: 'requestDebrief' }

// Phase-1 constants, preserved exactly (CalmReminder's timing web).
export const ESCALATE_SCORE = 70
/** New in Phase 2: hysteresis so the phase doesn't flap at the threshold. */
export const DEESCALATE_SCORE = 65
export const ESCALATION_SUSTAIN_MS = 5_000
/** Two full 4-7-8 breathing cycles (the M1 morph replaced the 30s modal). */
export const INTERVENTION_DURATION_MS = 38_000
export const INTERVENTION_COOLDOWN_MS = 60_000
export const MAX_TRANSCRIPT_ENTRIES = 600
export const MAX_HISTORY_POINTS = 300
export const MAX_FLAGGED_MOMENTS = 20

const ACTIVE_PHASES: readonly SessionPhase[] = [
  'calibrating',
  'listening',
  'escalated',
  'intervention',
]

export function createInitialSessionState(): SessionState {
  return {
    phase: 'idle',
    startedAt: null,
    endedAt: null,
    score: 30,
    emotionLevel: 'calm',
    scoreHistory: [],
    transcript: [],
    interim: '',
    escalatedSince: null,
    interventionEndsAt: null,
    interventionCooldownUntil: 0,
    interventionCount: 0,
    engines: { stt: 'groq', analysis: 'rules' },
    error: null,
    flaggedMoments: [],
  }
}

type SessionReduction = Reduction<SessionState, SessionEffect>

const stay = (state: SessionState): SessionReduction => ({ state })

function withScore(state: SessionState, score: number, level: EmotionLevel, at: number): SessionState {
  const nextHistory = [...state.scoreHistory, { timestamp: at, score, emotionLevel: level }]
  return {
    ...state,
    score,
    emotionLevel: level,
    scoreHistory:
      nextHistory.length > MAX_HISTORY_POINTS
        ? nextHistory.slice(nextHistory.length - MAX_HISTORY_POINTS)
        : nextHistory,
  }
}

function stopToRecap(state: SessionState, at: number): SessionReduction {
  return {
    state: { ...state, phase: 'recap', endedAt: at, interim: '' },
    effects: [{ kind: 'releaseMic' }, { kind: 'persistSession' }, { kind: 'requestDebrief' }],
  }
}

/**
 * Sustained hostility counts from whichever is later: the escalation start
 * or the end of the previous intervention's cooldown. This mirrors Phase 1,
 * where the 5s timer could not start during the cooldown window.
 */
function interventionDue(state: SessionState, at: number): boolean {
  if (state.escalatedSince === null) {
    return false
  }
  const effectiveSince = Math.max(state.escalatedSince, state.interventionCooldownUntil)
  return at - effectiveSince >= ESCALATION_SUSTAIN_MS && at >= state.interventionCooldownUntil
}

export function sessionReducer(state: SessionState, event: SessionEvent): SessionReduction {
  // Wildcard rows: orthogonal engine state and transcript flow are valid in
  // any active phase; they never change the phase.
  switch (event.type) {
    case 'STT_ENGINE_CHANGED':
      if (state.engines.stt === event.engine) {
        return stay(state)
      }
      return stay({ ...state, engines: { ...state.engines, stt: event.engine } })
    case 'ANALYSIS_MODE_CHANGED':
      if (state.engines.analysis === event.mode) {
        return stay(state)
      }
      return stay({ ...state, engines: { ...state.engines, analysis: event.mode } })
    case 'TRANSCRIPT_FINALIZED': {
      if (!ACTIVE_PHASES.includes(state.phase) || event.entries.length === 0) {
        return stay(state)
      }
      const next = [...state.transcript, ...event.entries]
      return stay({
        ...state,
        transcript:
          next.length > MAX_TRANSCRIPT_ENTRIES
            ? next.slice(next.length - MAX_TRANSCRIPT_ENTRIES)
            : next,
      })
    }
    case 'INTERIM_CHANGED':
      if (!ACTIVE_PHASES.includes(state.phase)) {
        return stay(state)
      }
      return stay({ ...state, interim: event.text })
    case 'REWRITE_OFFERED': {
      if (!ACTIVE_PHASES.includes(state.phase)) {
        return stay(state)
      }
      const moments = [...state.flaggedMoments, event.moment].slice(-MAX_FLAGGED_MOMENTS)
      return stay({ ...state, flaggedMoments: moments })
    }
    default:
      break
  }

  switch (state.phase) {
    case 'idle': {
      if (event.type === 'START_REQUESTED') {
        return {
          state: {
            ...createInitialSessionState(),
            phase: 'calibrating',
            engines: state.engines,
          },
          effects: [{ kind: 'acquireMic' }],
        }
      }
      return stay(state)
    }

    case 'calibrating': {
      switch (event.type) {
        case 'MIC_READY':
          return stay({ ...state, startedAt: event.at })
        case 'MIC_DENIED':
          return {
            state: { ...state, phase: 'idle', error: event.reason },
            effects: [{ kind: 'releaseMic' }],
          }
        case 'CALIBRATION_COMPLETE':
          return stay({ ...state, phase: 'listening', startedAt: state.startedAt ?? event.at })
        case 'STOP_REQUESTED':
          return stopToRecap(state, event.at)
        default:
          return stay(state)
      }
    }

    case 'listening': {
      switch (event.type) {
        case 'SCORE_UPDATED': {
          const next = withScore(state, event.score, event.level, event.at)
          if (event.score >= ESCALATE_SCORE) {
            return stay({ ...next, phase: 'escalated', escalatedSince: event.at })
          }
          return stay(next)
        }
        case 'STOP_REQUESTED':
          return stopToRecap(state, event.at)
        default:
          return stay(state)
      }
    }

    case 'escalated': {
      switch (event.type) {
        case 'SCORE_UPDATED': {
          const next = withScore(state, event.score, event.level, event.at)
          // Hysteresis: only a drop below 65 de-escalates; 65-69 holds.
          if (event.score < DEESCALATE_SCORE) {
            return stay({ ...next, phase: 'listening', escalatedSince: null })
          }
          if (interventionDue(next, event.at)) {
            return stay({
              ...next,
              phase: 'intervention',
              interventionEndsAt: event.at + INTERVENTION_DURATION_MS,
              interventionCount: state.interventionCount + 1,
            })
          }
          return stay(next)
        }
        case 'TICK':
          if (interventionDue(state, event.at)) {
            return stay({
              ...state,
              phase: 'intervention',
              interventionEndsAt: event.at + INTERVENTION_DURATION_MS,
              interventionCount: state.interventionCount + 1,
            })
          }
          return stay(state)
        case 'STOP_REQUESTED':
          return stopToRecap(state, event.at)
        default:
          return stay(state)
      }
    }

    case 'intervention': {
      switch (event.type) {
        case 'SCORE_UPDATED':
          // Score keeps flowing during the breathing pause; no phase change.
          return stay(withScore(state, event.score, event.level, event.at))
        case 'INTERVENTION_ACKNOWLEDGED':
        case 'TICK': {
          const due =
            event.type === 'INTERVENTION_ACKNOWLEDGED' ||
            (state.interventionEndsAt !== null && event.at >= state.interventionEndsAt)
          if (!due) {
            return stay(state)
          }
          return stay({
            ...state,
            phase: 'listening',
            escalatedSince: null,
            interventionEndsAt: null,
            interventionCooldownUntil: event.at + INTERVENTION_COOLDOWN_MS,
          })
        }
        case 'STOP_REQUESTED':
          return stopToRecap(state, event.at)
        default:
          return stay(state)
      }
    }

    case 'recap': {
      if (event.type === 'RECAP_CLOSED') {
        return stay({ ...state, phase: 'idle' })
      }
      return stay(state)
    }
  }
}
