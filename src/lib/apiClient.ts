import type {
  AnalyzeRequest,
  AnalyzeResponse,
  RewriteRequest,
  RewriteResponse,
  ToneLabel,
  TranscribeResponse,
} from '../types/api'
import type { AppLanguage } from '../types/app'

// All calls use relative /api/... URLs so the same build works against the
// Vite dev proxy, `vercel dev`, and production.

const TRANSCRIBE_TIMEOUT_MS = 12_000
const ANALYZE_TIMEOUT_MS = 10_000
const REWRITE_TIMEOUT_MS = 12_000

const TONE_LABELS: ToneLabel[] = [
  'aggressive',
  'passive-aggressive',
  'defensive',
  'neutral',
  'positive',
]

export class ApiCallError extends Error {
  /** HTTP status, or 0 for network errors / timeouts / bad response shapes. */
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiCallError'
    this.status = status
  }
}

async function postWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, { ...init, method: 'POST', signal: controller.signal })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiCallError(0, 'TIMEOUT')
    }
    throw new ApiCallError(0, 'NETWORK_ERROR')
  } finally {
    clearTimeout(timer)
  }
}

export function toLanguageHint(language: AppLanguage): 'zh' | 'en' {
  return language === 'zh-CN' ? 'zh' : 'en'
}

export async function transcribe(
  audio: Blob,
  mime: string,
  langHint: 'zh' | 'en',
): Promise<TranscribeResponse> {
  const response = await postWithTimeout(
    `/api/transcribe?lang=${langHint}`,
    {
      headers: {
        'Content-Type': 'application/octet-stream',
        'x-audio-mime': mime,
      },
      body: audio,
    },
    TRANSCRIBE_TIMEOUT_MS,
  )

  if (!response.ok) {
    throw new ApiCallError(response.status, `HTTP_${response.status}`)
  }

  const data: unknown = await response.json().catch(() => null)
  if (
    typeof data !== 'object' ||
    data === null ||
    typeof (data as TranscribeResponse).transcript !== 'string' ||
    typeof (data as TranscribeResponse).language !== 'string'
  ) {
    throw new ApiCallError(0, 'BAD_RESPONSE_SHAPE')
  }

  return data as TranscribeResponse
}

async function postJson(url: string, payload: unknown, timeoutMs: number): Promise<unknown> {
  const response = await postWithTimeout(
    url,
    {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    timeoutMs,
  )

  if (!response.ok) {
    throw new ApiCallError(response.status, `HTTP_${response.status}`)
  }

  return response.json().catch(() => null)
}

// The server already schema-validates LLM output; these client-side checks
// only defend against proxy/transport bugs poisoning the score.
export async function analyze(request: AnalyzeRequest): Promise<AnalyzeResponse> {
  const data = (await postJson('/api/analyze', request, ANALYZE_TIMEOUT_MS)) as
    | Partial<AnalyzeResponse>
    | null

  if (
    !data ||
    typeof data.tone !== 'string' ||
    !TONE_LABELS.includes(data.tone as ToneLabel) ||
    typeof data.intensity !== 'number' ||
    !Number.isFinite(data.intensity) ||
    typeof data.rationale !== 'string'
  ) {
    throw new ApiCallError(0, 'BAD_RESPONSE_SHAPE')
  }

  return {
    tone: data.tone as ToneLabel,
    intensity: Math.min(100, Math.max(0, Math.round(data.intensity))),
    rationale: data.rationale,
  }
}

export async function rewriteUtterance(request: RewriteRequest): Promise<RewriteResponse> {
  const data = (await postJson('/api/rewrite', request, REWRITE_TIMEOUT_MS)) as
    | Partial<RewriteResponse>
    | null

  if (!data || typeof data.rewrite !== 'string' || data.rewrite.trim().length === 0) {
    throw new ApiCallError(0, 'BAD_RESPONSE_SHAPE')
  }

  return { rewrite: data.rewrite.trim() }
}
