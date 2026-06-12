import type { EmotionLevel } from '@/types/app'

const LEVEL_TO_TONE = {
  calm: 'calm',
  elevated: 'tense',
  heated: 'heated',
  critical: 'hostile',
} as const

/** CSS-variable bridge: emotion level -> theme-aware tone token. */
export const toneVar = (level: EmotionLevel): string => `var(--tone-${LEVEL_TO_TONE[level]})`
