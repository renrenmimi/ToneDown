import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { GymGradeRequest } from '../src/types/api.js'
import { contentLengthWithin, getClientIp, logRequest, requirePost, sendError } from './_lib/http.js'
import { checkRateLimit } from './_lib/ratelimit.js'
import { chatJSON, UpstreamError } from './_lib/groq.js'
import { buildGymGradeUserMessage, CORRECTIVE_MESSAGE, GYM_GRADE_SYSTEM_PROMPT } from './_lib/prompts.js'
import { parseGymGradeJson } from './_lib/schemas.js'

const ROUTE = 'gym-grade'
const MAX_BODY_BYTES = 8 * 1024
const RATE_LIMIT_PER_MINUTE = 6
const MAX_DRILL_ID_CHARS = 64
const MAX_PHRASE_CHARS = 200
const MAX_ATTEMPT_CHARS = 500
const UPSTREAM_TIMEOUT_MS = 8_000
const RETRY_TIMEOUT_MS = 6_000

export const config = { maxDuration: 30 }

function parseRequestBody(body: unknown): { phrase: string; attempt: string } | null {
  if (typeof body !== 'object' || body === null) {
    return null
  }
  const candidate = body as Partial<GymGradeRequest>
  if (
    typeof candidate.drillId !== 'string' ||
    candidate.drillId.length === 0 ||
    candidate.drillId.length > MAX_DRILL_ID_CHARS ||
    typeof candidate.phrase !== 'string' ||
    typeof candidate.attempt !== 'string'
  ) {
    return null
  }
  const phrase = candidate.phrase.trim().slice(0, MAX_PHRASE_CHARS)
  const attempt = candidate.attempt.trim().slice(0, MAX_ATTEMPT_CHARS)
  if (phrase.length === 0 || attempt.length < 2) {
    return null
  }
  return { phrase, attempt }
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

  try {
    const result = await chatJSON({
      messages: [
        { role: 'system', content: GYM_GRADE_SYSTEM_PROMPT },
        { role: 'user', content: buildGymGradeUserMessage(parsed.phrase, parsed.attempt) },
      ],
      temperature: 0.3,
      maxTokens: 160,
      validate: parseGymGradeJson,
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
