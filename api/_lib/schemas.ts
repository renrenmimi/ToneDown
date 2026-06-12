import { z } from 'zod'
import type { DebriefResponse, GymGradeResponse, SparringResponse } from '../../src/types/api.js'

// Server-only zod schemas for LLM outputs. Deliberately NOT shared with the
// client at runtime: a runtime-shared module would have to satisfy both the
// api/ nodenext resolver and the src/ bundler resolver — the exact foot-gun
// class behind the FUNCTION_INVOCATION_FAILED incident. Drift protection is
// type-level instead: each schema is pinned to the wire type from
// src/types/api.ts via `satisfies`, and a vitest fixture test asserts the
// client guard and this schema agree.

export function stripCodeFence(raw: string): string {
  const trimmed = raw.trim()
  const match = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(trimmed)
  return match ? match[1] : trimmed
}

const boundedString = (max: number) => z.string().trim().min(1).max(max)

export const debriefResponseSchema = z.object({
  summary: boundedString(600),
  emotional_arc: boundedString(450),
  trigger_moments: z
    .array(
      z.object({
        quote: boundedString(300),
        why_it_escalated: boundedString(300),
        better_phrasing: boundedString(300),
      }),
    )
    .max(3),
  one_habit_to_practice: boundedString(300),
}) satisfies z.ZodType<DebriefResponse>

/** chatJSON-compatible validator: raw LLM text -> DebriefResponse | null. */
export function parseDebriefJson(raw: string): DebriefResponse | null {
  try {
    const parsed: unknown = JSON.parse(stripCodeFence(raw))
    const result = debriefResponseSchema.safeParse(parsed)
    return result.success ? result.data : null
  } catch {
    return null
  }
}

const toneLabelSchema = z.enum([
  'aggressive',
  'passive-aggressive',
  'defensive',
  'neutral',
  'positive',
])

export const sparringResponseSchema = z.object({
  reply: boundedString(400),
  user_tone: toneLabelSchema,
  intensity: z.number().finite(),
  constructive: z.boolean(),
  coach_hint: z.string().trim().max(200),
}) satisfies z.ZodType<SparringResponse>

export function parseSparringJson(raw: string): SparringResponse | null {
  try {
    const parsed: unknown = JSON.parse(stripCodeFence(raw))
    const result = sparringResponseSchema.safeParse(parsed)
    if (!result.success) {
      return null
    }
    return {
      ...result.data,
      intensity: Math.min(100, Math.max(0, Math.round(result.data.intensity))),
    }
  } catch {
    return null
  }
}

const gymGradeRawSchema = z.object({
  score: z.number().finite(),
  feedback: boundedString(300),
  better_version: boundedString(400),
})

export const gymGradeResponseSchema = gymGradeRawSchema satisfies z.ZodType<
  Omit<GymGradeResponse, 'passed'>
>

/** `passed` is derived server-side — the model only emits the score. */
export function parseGymGradeJson(raw: string): GymGradeResponse | null {
  try {
    const parsed: unknown = JSON.parse(stripCodeFence(raw))
    const result = gymGradeRawSchema.safeParse(parsed)
    if (!result.success) {
      return null
    }
    const score = Math.min(100, Math.max(0, Math.round(result.data.score)))
    return {
      score,
      passed: score >= 90,
      feedback: result.data.feedback,
      better_version: result.data.better_version,
    }
  } catch {
    return null
  }
}
