import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { AnalyzeRequest } from '../src/types/api.js'
import { contentLengthWithin, getClientIp, logRequest, requirePost, sendError } from './_lib/http.js'
import { checkRateLimit } from './_lib/ratelimit.js'
import { chatJSON, UpstreamError } from './_lib/groq.js'
import { ANALYZE_SYSTEM_PROMPT, buildAnalyzeUserMessage, CORRECTIVE_MESSAGE } from './_lib/prompts.js'
import { parseAnalyzeJson } from './_lib/validate.js'

const ROUTE = 'analyze'
const MAX_BODY_BYTES = 16 * 1024
const RATE_LIMIT_PER_MINUTE = 30
const MAX_TEXT_CHARS = 1_000
const MAX_CONTEXT_ENTRIES = 10
const MAX_CONTEXT_ENTRY_CHARS = 500
const UPSTREAM_TIMEOUT_MS = 6_000
const RETRY_TIMEOUT_MS = 5_000

export const config = { maxDuration: 30 }

function parseRequestBody(body: unknown): { text: string; context: string[] } | null {
  if (typeof body !== 'object' || body === null) {
    return null
  }
  const candidate = body as Partial<AnalyzeRequest>

  if (typeof candidate.text !== 'string') {
    return null
  }
  const text = candidate.text.trim()
  if (text.length === 0 || text.length > MAX_TEXT_CHARS) {
    return null
  }

  let context: string[] = []
  if (candidate.context !== undefined) {
    if (!Array.isArray(candidate.context) || candidate.context.some((c) => typeof c !== 'string')) {
      return null
    }
    context = candidate.context
      .slice(-MAX_CONTEXT_ENTRIES)
      .map((entry) => entry.slice(0, MAX_CONTEXT_ENTRY_CHARS))
  }

  return { text, context }
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
        { role: 'system', content: ANALYZE_SYSTEM_PROMPT },
        { role: 'user', content: buildAnalyzeUserMessage(parsed.text, parsed.context) },
      ],
      temperature: 0.2,
      maxTokens: 150,
      validate: parseAnalyzeJson,
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
