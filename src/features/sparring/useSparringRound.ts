import { useCallback, useEffect, useRef, useState } from 'react'
import { sparringEndpoint } from '@/shared/llm/endpoints'
import type { SparringResponse, SparringTurn } from '@/types/api'
import type { Locale } from '@/shared/i18n/localeContext'
import {
  CALM_INTENSITY_MAX,
  CALM_REWARD,
  SLIP_INTENSITY_MIN,
  TURN_CAP,
  WIN_MOOD,
  type PersonaConfig,
} from './personas'

export type RoundPhase = 'playing' | 'won' | 'lost-stormed' | 'lost-cap'

export interface TurnGrade {
  tone: SparringResponse['user_tone']
  intensity: number
  constructive: boolean
  hint: string
}

export interface ChatTurn {
  role: 'user' | 'partner'
  text: string
  grade?: TurnGrade
}

export interface RoundState {
  phase: RoundPhase
  mood: number
  turns: ChatTurn[]
  userTurns: number
  calmStreak: number
  bestCalmStreak: number
  slips: { quote: string; intensity: number }[]
  inFlight: boolean
  apiDown: boolean
}

function initialState(persona: PersonaConfig, opener: string): RoundState {
  return {
    phase: 'playing',
    mood: persona.moodStart,
    turns: [{ role: 'partner', text: opener }],
    userTurns: 0,
    calmStreak: 0,
    bestCalmStreak: 0,
    slips: [],
    inFlight: false,
    apiDown: false,
  }
}

/**
 * The round engine. Game state (mood meter, streaks, win/loss) is computed
 * deterministically CLIENT-side from the per-turn grades; the LLM renders
 * the character and grades the user — it never decides the outcome.
 */
export function useSparringRound(
  persona: PersonaConfig,
  opener: string,
  locale: Locale,
  onPartnerReply: (text: string) => void,
  onRoundEnd: (state: RoundState) => void,
) {
  const [state, setState] = useState<RoundState>(() => initialState(persona, opener))
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])

  const send = useCallback(
    (rawText: string) => {
      const text = rawText.trim().slice(0, 300)
      const current = stateRef.current
      if (text.length === 0 || current.inFlight || current.phase !== 'playing') {
        return
      }

      const userTurn: ChatTurn = { role: 'user', text }
      const turnsWithUser = [...current.turns, userTurn]
      const pending: RoundState = { ...current, turns: turnsWithUser, inFlight: true }
      // Claim the in-flight slot synchronously. The ref is otherwise only
      // refreshed by an effect after commit, so two sends in one tick (key
      // repeat on the form) would both read inFlight:false and double-spend.
      stateRef.current = pending
      setState(pending)

      const history: SparringTurn[] = turnsWithUser
        .slice(-12)
        .map((t) => ({ role: t.role, text: t.text }))

      void sparringEndpoint
        .call({ language: locale, personaId: persona.id, mood: current.mood, history })
        .then((result) => {
          const grade: TurnGrade = {
            tone: result.user_tone,
            intensity: result.intensity,
            constructive: result.constructive,
            hint: result.coach_hint,
          }

          const calmTurn = result.constructive && result.intensity <= CALM_INTENSITY_MAX
          const hostileTurn =
            result.user_tone === 'aggressive' || result.intensity >= SLIP_INTENSITY_MIN

          let mood = current.mood - persona.moodDecay
          if (calmTurn) {
            mood += CALM_REWARD + persona.moodDecay // calm turns beat the ambient decay
          } else if (hostileTurn) {
            mood -= persona.provocation * 4
          }
          mood = Math.min(100, Math.max(0, mood))

          const calmStreak = calmTurn ? current.calmStreak + 1 : 0
          const userTurns = current.userTurns + 1

          let phase: RoundPhase = 'playing'
          if (mood >= WIN_MOOD && calmStreak >= persona.streakNeeded) {
            phase = 'won'
          } else if (mood <= 0) {
            phase = 'lost-stormed'
          } else if (userTurns >= TURN_CAP) {
            phase = 'lost-cap'
          }

          const next: RoundState = {
            phase,
            mood,
            turns: [
              ...turnsWithUser.slice(0, -1),
              { ...userTurn, grade },
              { role: 'partner', text: result.reply },
            ],
            userTurns,
            calmStreak,
            bestCalmStreak: Math.max(current.bestCalmStreak, calmStreak),
            slips:
              result.intensity >= SLIP_INTENSITY_MIN
                ? [...current.slips, { quote: text, intensity: result.intensity }]
                : current.slips,
            inFlight: false,
            apiDown: false,
          }
          setState(next)
          onPartnerReply(result.reply)
          if (phase !== 'playing') {
            onRoundEnd(next)
          }
        })
        .catch(() => {
          // Honest failure: keep the user's turn, surface the resting note,
          // let them retry. No fake persona lines.
          setState({
            ...stateRef.current,
            turns: turnsWithUser,
            inFlight: false,
            apiDown: true,
          })
        })
    },
    [locale, onPartnerReply, onRoundEnd, persona],
  )

  return { state, send }
}
