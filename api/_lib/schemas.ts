import { z } from 'zod'
import type { DebriefResponse } from '../../src/types/api.js'

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
