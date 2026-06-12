import type { SparringPersonaId } from '@/types/api'

// Client-side persona config: difficulty knobs + voice. The prompts that
// define behavior live server-side; the client only ever names an id.

export interface PersonaConfig {
  id: SparringPersonaId
  tier: 1 | 2 | 3
  emoji: string
  voice: { lang: 'en-US' | 'zh-CN'; rate: number; pitch: number }
  /** Hidden mood meter knobs. */
  moodStart: number
  moodDecay: number
  provocation: number
  streakNeeded: number
}

export const PERSONAS: PersonaConfig[] = [
  {
    id: 'slow-barista',
    tier: 1,
    emoji: '☕',
    voice: { lang: 'en-US', rate: 0.75, pitch: 0.95 },
    moodStart: 70,
    moodDecay: 1,
    provocation: 1,
    streakNeeded: 2,
  },
  {
    id: 'pushy-salesperson',
    tier: 1,
    emoji: '🛍️',
    voice: { lang: 'en-US', rate: 1.15, pitch: 1.1 },
    moodStart: 60,
    moodDecay: 2,
    provocation: 1,
    streakNeeded: 2,
  },
  {
    id: 'passive-aggressive-coworker',
    tier: 2,
    emoji: '💼',
    voice: { lang: 'en-US', rate: 1.0, pitch: 0.9 },
    moodStart: 50,
    moodDecay: 2,
    provocation: 2,
    streakNeeded: 3,
  },
  {
    id: 'unreasonable-landlord',
    tier: 2,
    emoji: '🏠',
    voice: { lang: 'en-US', rate: 1.05, pitch: 0.85 },
    moodStart: 45,
    moodDecay: 3,
    provocation: 2,
    streakNeeded: 3,
  },
  {
    id: 'critical-relative',
    tier: 3,
    emoji: '🧧',
    voice: { lang: 'zh-CN', rate: 1.1, pitch: 1.15 },
    moodStart: 40,
    moodDecay: 3,
    provocation: 3,
    streakNeeded: 3,
  },
  {
    id: 'furious-customer',
    tier: 3,
    emoji: '📦',
    voice: { lang: 'en-US', rate: 1.25, pitch: 1.05 },
    moodStart: 25,
    moodDecay: 4,
    provocation: 3,
    streakNeeded: 4,
  },
]

export const TURN_CAP = 14
export const WIN_MOOD = 85
export const CALM_INTENSITY_MAX = 45
export const SLIP_INTENSITY_MIN = 60
export const CALM_REWARD = 8

export function moodWeather(mood: number): string {
  if (mood >= 70) return '☀️'
  if (mood >= 45) return '⛅'
  if (mood >= 20) return '🌧️'
  return '⛈️'
}
