import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { SparringPersonaId, SparringRequest, SparringTurn } from '../src/types/api.js'
import { contentLengthWithin, getClientIp, logRequest, requirePost, sendError } from './_lib/http.js'
import { checkRateLimit } from './_lib/ratelimit.js'
import { chatJSON, UpstreamError } from './_lib/groq.js'
import { buildSparringSystemPrompt, CORRECTIVE_MESSAGE } from './_lib/prompts.js'
import { parseSparringJson } from './_lib/schemas.js'

// DELIBERATELY NOT STREAMING: Groq's llama-3.3-70b completes a <=220-token
// persona reply in well under 1s wall time (measured p50 ~0.2-0.8s in this
// repo's Phase-1 instrumentation at ~275 tok/s). Below that threshold token
// streaming doesn't change perceived latency, and a streamed response can't
// be schema-validated before rendering — it would break the strict
// validate-then-render contract every other route honors. The client shows
// a typing indicator instead.

const ROUTE = 'sparring'
const MAX_BODY_BYTES = 24 * 1024
const RATE_LIMIT_PER_MINUTE = 12
const MAX_TURNS = 12
const MAX_TURN_CHARS = 300
const UPSTREAM_TIMEOUT_MS = 8_000
const RETRY_TIMEOUT_MS = 6_000

export const config = { maxDuration: 30 }

const PERSONA_IDS: SparringPersonaId[] = [
  'slow-barista',
  'pushy-salesperson',
  'passive-aggressive-coworker',
  'unreasonable-landlord',
  'critical-relative',
  'furious-customer',
]

interface ParsedBody {
  personaId: SparringPersonaId
  mood: number
  language: string
  history: SparringTurn[]
}

function parseRequestBody(body: unknown): ParsedBody | null {
  if (typeof body !== 'object' || body === null) {
    return null
  }
  const candidate = body as Partial<SparringRequest>

  if (!PERSONA_IDS.includes(candidate.personaId as SparringPersonaId)) {
    return null
  }
  if (!Number.isFinite(candidate.mood)) {
    return null
  }
  if (!Array.isArray(candidate.history) || candidate.history.length === 0) {
    return null
  }
  const history: SparringTurn[] = []
  for (const turn of candidate.history.slice(-MAX_TURNS)) {
    if (
      typeof turn !== 'object' ||
      turn === null ||
      (turn.role !== 'user' && turn.role !== 'partner') ||
      typeof turn.text !== 'string'
    ) {
      return null
    }
    history.push({ role: turn.role, text: turn.text.slice(0, MAX_TURN_CHARS) })
  }
  if (history[history.length - 1].role !== 'user') {
    return null
  }

  return {
    personaId: candidate.personaId as SparringPersonaId,
    mood: Math.min(100, Math.max(0, Math.round(candidate.mood as number))),
    language: candidate.language === 'zh-CN' ? 'zh-CN' : 'en-US',
    history,
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const startedAt = Date.now()
  const finish = (status: number) => logRequest(ROUTE, status, startedAt)

  if (!requirePost(req, res)) {
    return finish(405)
  }

  const rate = checkRateLimit(ROUTE, getClientIp(req), RATE_LIMIT_PER_MINUTE)
  if (!rate.ok) {
    sendError(res, 429, 'RATE_LIMITED', rate.retryAfter)
    return finish(429)
  }

  if (!contentLengthWithin(req, MAX_BODY_BYTES)) {
    sendError(res, 413, 'PAYLOAD_TOO_LARGE')
    return finish(413)
  }

  const parsed = parseRequestBody(req.body)
  if (!parsed) {
    sendError(res, 400, 'INVALID_BODY')
    return finish(400)
  }

  const transcript = parsed.history
    .map((turn) => `${turn.role === 'user' ? 'User' : 'You'}: ${turn.text}`)
    .join('\n')

  try {
    const result = await chatJSON({
      messages: [
        {
          role: 'system',
          content: buildSparringSystemPrompt(parsed.personaId, parsed.mood, parsed.language),
        },
        { role: 'user', content: `Conversation so far:\n${transcript}` },
      ],
      temperature: 0.8,
      maxTokens: 220,
      validate: parseSparringJson,
      correctiveMessage: CORRECTIVE_MESSAGE,
      timeoutMs: UPSTREAM_TIMEOUT_MS,
      retryTimeoutMs: RETRY_TIMEOUT_MS,
    })

    res.status(200).json(result)
    return finish(200)
  } catch (error) {
    const status = error instanceof UpstreamError ? error.status : 502
    const code = error instanceof UpstreamError ? error.message : 'UPSTREAM_ERROR'
    sendError(res, status, code)
    return finish(status)
  }
}
