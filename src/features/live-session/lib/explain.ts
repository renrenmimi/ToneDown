import type { ToneLabel } from '@/types/api'
import type { SignalBreakdown } from '@/types/app'
import { BASE_SCORE, MAX_ACOUSTIC_BONUS } from './fusion'

// Why a reminder fired, derived purely from the tick that fired it.
//
// The fusion blend is linear, so the score above the 30-point baseline splits
// EXACTLY into three additive terms:
//
//   score - BASE = (1-w)*(volume+speed) + (1-w)*keywords + w*(semantic - BASE)
//
// Those three terms are what the UI shows. Nothing here re-derives or
// re-weights anything: the explanation is arithmetic on the same numbers the
// score was made of, which is why it can never disagree with the gauge.

/** The two kinds of nudge the app gives: a breathing pause and a rewrite. */
export type ReminderKind = 'breathing' | 'rewrite'

/** Which family of evidence pushed the score into the trigger band. */
export type TriggerDriver = 'acoustic' | 'semantic' | 'keyword' | 'combined'

export interface ReminderEvent {
  at: number
  kind: ReminderKind
  /** Fused score at the moment the reminder fired. */
  score: number
  /** Null when the reminder fired before any tick carried provenance. */
  signals: SignalBreakdown | null
  /** Present on rewrite reminders: the sentence that was flagged. */
  quote?: string
}

export interface Contributions {
  /** Points from loudness and pace. */
  acoustic: number
  /** Points from the local hostility lexicon. */
  keyword: number
  /** Points from the model's tone read; negative when it reads calm. */
  semantic: number
}

/** How far one side must lead the other to be named the sole driver. */
export const DOMINANCE_RATIO = 1.25

/** Three high-risk keywords in the 30s window reads as a maxed-out lexicon. */
export const KEYWORD_STRENGTH_FULL = 45

/** Residual (in points) still treated as rounding noise rather than a real gap. */
export const MAX_ROUNDING_RESIDUAL = 2

export function contributionsOf(signals: SignalBreakdown): Contributions {
  const weight = signals.semantic.score === null ? 0 : signals.semantic.weight
  const acousticBonus = signals.acoustic.volumeBonus + signals.acoustic.speedBonus
  const keywordBonus = signals.semantic.keywordBonus

  // The rules side is clamped to 100 BEFORE the blend, so when loudness plus
  // lexicon overflow the scale their claim has to shrink with it — otherwise
  // the terms would take credit for points the score never actually moved.
  const rawBonus = acousticBonus + keywordBonus
  const headroom = 100 - BASE_SCORE
  const scale = rawBonus > headroom ? headroom / rawBonus : 1

  return {
    acoustic: (1 - weight) * acousticBonus * scale,
    keyword: (1 - weight) * keywordBonus * scale,
    semantic: weight * ((signals.semantic.score ?? BASE_SCORE) - BASE_SCORE),
  }
}

/**
 * The integers the card prints. Rounding three terms independently can drift
 * a point off the score they are explaining, so the remainder is folded into
 * the largest term — the reader can add the column up and get the number.
 *
 * A floored tick is left alone: its score was overridden, not blended, and
 * the floor note says so.
 */
export function pointsFor(signals: SignalBreakdown, score: number): Contributions {
  const parts = contributionsOf(signals)
  const rounded: Contributions = {
    acoustic: Math.round(parts.acoustic),
    keyword: Math.round(parts.keyword),
    semantic: Math.round(parts.semantic),
  }

  if (signals.semantic.floorApplied) {
    return rounded
  }

  const residual =
    score - BASE_SCORE - (rounded.acoustic + rounded.keyword + rounded.semantic)
  if (residual === 0 || Math.abs(residual) > MAX_ROUNDING_RESIDUAL) {
    return rounded
  }

  const largest = (['semantic', 'acoustic', 'keyword'] as const).reduce((best, key) =>
    Math.abs(parts[key]) > Math.abs(parts[best]) ? key : best,
  )
  return { ...rounded, [largest]: rounded[largest] + residual }
}

/**
 * The headline answer to "why did this fire?". Only evidence that pushed the
 * score UP can drive a reminder, so calming (negative) terms are floored at
 * zero before comparing.
 */
export function dominantDriver(signals: SignalBreakdown): TriggerDriver {
  // A floored tick was quiet by construction: the model's read is the only
  // reason the score reached the band at all.
  if (signals.semantic.floorApplied) {
    return 'semantic'
  }

  const parts = contributionsOf(signals)
  const acoustic = Math.max(0, parts.acoustic)
  const keyword = Math.max(0, parts.keyword)
  const semantic = Math.max(0, parts.semantic)
  const text = keyword + semantic

  if (text === 0 && acoustic === 0) {
    return 'combined'
  }
  if (text >= acoustic * DOMINANCE_RATIO) {
    return semantic >= keyword ? 'semantic' : 'keyword'
  }
  if (acoustic >= text * DOMINANCE_RATIO) {
    return 'acoustic'
  }
  return 'combined'
}

/** Positive contributions normalized to 0-1, for the stacked share bar. */
export function evidenceShares(signals: SignalBreakdown): Contributions {
  const parts = contributionsOf(signals)
  const acoustic = Math.max(0, parts.acoustic)
  const keyword = Math.max(0, parts.keyword)
  const semantic = Math.max(0, parts.semantic)
  const total = acoustic + keyword + semantic

  if (total === 0) {
    return { acoustic: 0, keyword: 0, semantic: 0 }
  }
  return { acoustic: acoustic / total, keyword: keyword / total, semantic: semantic / total }
}

export interface TrackValues {
  /** 0-100 strength of what the mic heard. */
  acoustic: number
  /** 0-100 strength of what the words meant. */
  semantic: number
  /** Whether the semantic value came from the model or the local lexicon. */
  semanticSource: 'llm' | 'lexicon'
  /** Tone band colouring the semantic bar; null in lexicon-only ticks. */
  tone: ToneLabel | null
  hasKeyword: boolean
}

/**
 * The two comparable 0-100 track heights the timeline draws. The semantic
 * track falls back to lexicon strength when the model is unavailable, so a
 * degraded stretch reads as "thinner evidence", not as silence.
 */
export function trackValues(signals: SignalBreakdown): TrackValues {
  const { acoustic, semantic } = signals
  const acousticValue = Math.round(
    ((acoustic.volumeBonus + acoustic.speedBonus) / MAX_ACOUSTIC_BONUS) * 100,
  )
  const hasKeyword = semantic.highRiskKeywords.length > 0 || semantic.mediumRiskKeywords.length > 0

  if (semantic.score !== null) {
    return {
      acoustic: acousticValue,
      semantic: Math.round(semantic.score),
      semanticSource: 'llm',
      tone: semantic.tone,
      hasKeyword,
    }
  }

  return {
    acoustic: acousticValue,
    semantic: Math.min(100, Math.round((semantic.keywordBonus / KEYWORD_STRENGTH_FULL) * 100)),
    semanticSource: 'lexicon',
    tone: null,
    hasKeyword,
  }
}

/** Signed, rounded point label for the explanation copy ("+18", "-7"). */
export const formatPoints = (value: number): string => {
  const rounded = Math.round(value)
  return rounded > 0 ? `+${rounded}` : String(rounded)
}
