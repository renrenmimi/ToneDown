import type {
  AnalyzeResponse,
  DebriefResponse,
  DebriefTriggerMoment,
  RewriteResponse,
  SparringResponse,
  ToneLabel,
  TranscribeResponse,
} from '@/types/api'

// Client-side response guards. The server already schema-validates LLM
// output (with a corrective retry); these only defend against transport
// corruption or a proxy bug poisoning the UI — which is why they are
// ~70 lines of combinators instead of a 13KB schema library. Server zod
// schemas and these guards are both type-pinned to src/types/api.ts, so
// wire-type drift fails `tsc -b` on whichever side lags.

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const isString = (value: unknown): value is string => typeof value === 'string'

export const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

export const isOneOf =
  <T extends string>(allowed: readonly T[]) =>
  (value: unknown): value is T =>
    typeof value === 'string' && (allowed as readonly string[]).includes(value)

export const isArrayOf =
  <T>(item: (value: unknown) => value is T) =>
  (value: unknown): value is T[] =>
    Array.isArray(value) && value.every(item)

export const TONE_LABELS = [
  'aggressive',
  'passive-aggressive',
  'defensive',
  'neutral',
  'positive',
] as const

export const isToneLabel = isOneOf<ToneLabel>(TONE_LABELS)

export const clamp0to100 = (value: number): number =>
  Math.min(100, Math.max(0, Math.round(value)))

export function parseTranscribeResponse(data: unknown): TranscribeResponse | null {
  if (!isRecord(data) || !isString(data.transcript) || !isString(data.language)) {
    return null
  }
  return { transcript: data.transcript, language: data.language }
}

export function parseAnalyzeResponse(data: unknown): AnalyzeResponse | null {
  if (
    !isRecord(data) ||
    !isToneLabel(data.tone) ||
    !isFiniteNumber(data.intensity) ||
    !isString(data.rationale)
  ) {
    return null
  }
  return {
    tone: data.tone,
    intensity: clamp0to100(data.intensity),
    rationale: data.rationale,
  }
}

export function parseRewriteResponse(data: unknown): RewriteResponse | null {
  if (!isRecord(data) || !isString(data.rewrite) || data.rewrite.trim().length === 0) {
    return null
  }
  return { rewrite: data.rewrite.trim() }
}

const isTriggerMoment = (value: unknown): value is DebriefTriggerMoment =>
  isRecord(value) &&
  isString(value.quote) &&
  isString(value.why_it_escalated) &&
  isString(value.better_phrasing)

export function parseDebriefResponse(data: unknown): DebriefResponse | null {
  if (
    !isRecord(data) ||
    !isString(data.summary) ||
    !isString(data.emotional_arc) ||
    !isArrayOf(isTriggerMoment)(data.trigger_moments) ||
    !isString(data.one_habit_to_practice)
  ) {
    return null
  }
  return {
    summary: data.summary,
    emotional_arc: data.emotional_arc,
    trigger_moments: data.trigger_moments.slice(0, 3),
    one_habit_to_practice: data.one_habit_to_practice,
  }
}

export function parseSparringResponse(data: unknown): SparringResponse | null {
  if (
    !isRecord(data) ||
    !isString(data.reply) ||
    data.reply.trim().length === 0 ||
    !isToneLabel(data.user_tone) ||
    !isFiniteNumber(data.intensity) ||
    typeof data.constructive !== 'boolean' ||
    !isString(data.coach_hint)
  ) {
    return null
  }
  return {
    reply: data.reply.trim(),
    user_tone: data.user_tone,
    intensity: clamp0to100(data.intensity),
    constructive: data.constructive,
    coach_hint: data.coach_hint.trim(),
  }
}
