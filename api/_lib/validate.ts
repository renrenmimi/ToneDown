import type { AnalyzeResponse, RewriteResponse, ToneLabel } from '../../src/types/api.js'

const TONE_LABELS: ToneLabel[] = [
  'aggressive',
  'passive-aggressive',
  'defensive',
  'neutral',
  'positive',
]

/** Strips an optional ```json ... ``` fence the model may wrap around its output. */
function stripCodeFence(raw: string): string {
  const trimmed = raw.trim()
  const match = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(trimmed)
  return match ? match[1] : trimmed
}

function parseJsonObject(raw: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(stripCodeFence(raw))
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
    return null
  } catch {
    return null
  }
}

function normalizeTone(value: unknown): ToneLabel | null {
  if (typeof value !== 'string') {
    return null
  }
  const normalized = value.trim().toLowerCase().replace(/[\s_]+/g, '-')
  return (TONE_LABELS as string[]).includes(normalized) ? (normalized as ToneLabel) : null
}

export function parseAnalyzeJson(raw: string): AnalyzeResponse | null {
  const obj = parseJsonObject(raw)
  if (!obj) {
    return null
  }

  const tone = normalizeTone(obj.tone)
  if (!tone) {
    return null
  }

  const intensityNumber = Number(obj.intensity)
  if (!Number.isFinite(intensityNumber)) {
    return null
  }
  const intensity = Math.min(100, Math.max(0, Math.round(intensityNumber)))

  // Rationale is non-critical: default to '' rather than rejecting the response.
  const rationale =
    typeof obj.rationale === 'string' ? obj.rationale.trim().slice(0, 200) : ''

  return { tone, intensity, rationale }
}

export function parseRewriteJson(raw: string, originalUtterance: string): RewriteResponse | null {
  const obj = parseJsonObject(raw)
  if (!obj || typeof obj.rewrite !== 'string') {
    return null
  }

  const rewrite = obj.rewrite.trim().slice(0, 400)
  if (rewrite.length === 0 || rewrite === originalUtterance.trim()) {
    return null
  }

  return { rewrite }
}
