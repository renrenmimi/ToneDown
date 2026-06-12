import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { DebriefRequest } from '../src/types/api.js'
import { contentLengthWithin, getClientIp, logRequest, requirePost, sendError } from './_lib/http.js'
import { checkRateLimit } from './_lib/ratelimit.js'
import { chatJSON, UpstreamError } from './_lib/groq.js'
import { buildDebriefUserMessage, CORRECTIVE_MESSAGE, DEBRIEF_SYSTEM_PROMPT } from './_lib/prompts.js'
import { parseDebriefJson } from './_lib/schemas.js'

const ROUTE = 'debrief'
const MAX_BODY_BYTES = 48 * 1024
const RATE_LIMIT_PER_MINUTE = 4
const MAX_ENTRIES = 80
const MAX_ENTRY_CHARS = 280
const MAX_SERIES_POINTS = 60
const UPSTREAM_TIMEOUT_MS = 15_000
const RETRY_TIMEOUT_MS = 10_000

export const config = { maxDuration: 30 }

function parseRequestBody(
  body: unknown,
): { durationMs: number; entries: { text: string; score: number }[]; series: [number, number][] } | null {
  if (typeof body !== 'object' || body === null) {
    return null
  }
  const candidate = body as Partial<DebriefRequest>

  if (!Number.isFinite(candidate.durationMs) || (candidate.durationMs as number) < 0) {
    return null
  }
  if (!Array.isArray(candidate.entries) || candidate.entries.length === 0) {
    return null
  }
  const entries = candidate.entries.slice(0, MAX_ENTRIES).map((entry) => {
    if (
      typeof entry !== 'object' ||
      entry === null ||
      typeof entry.text !== 'string' ||
      !Number.isFinite(entry.score)
    ) {
      return null
    }
    return {
      text: entry.text.slice(0, MAX_ENTRY_CHARS),
      score: Math.min(100, Math.max(0, Math.round(entry.score))),
    }
  })
  if (entries.some((e) => e === null)) {
    return null
  }

  let series: [number, number][] = []
  if (candidate.scoreSeries !== undefined) {
    if (!Array.isArray(candidate.scoreSeries)) {
      return null
    }
    series = candidate.scoreSeries
      .slice(0, MAX_SERIES_POINTS)
      .filter(
        (p): p is [number, number] =>
          Array.isArray(p) && p.length === 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]),
      )
  }

  return {
    durationMs: candidate.durationMs as number,
    entries: entries as { text: string; score: number }[],
    series,
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

  try {
    const result = await chatJSON({
      messages: [
        { role: 'system', content: DEBRIEF_SYSTEM_PROMPT },
        {
          role: 'user',
          content: buildDebriefUserMessage(parsed.durationMs, parsed.entries, parsed.series),
        },
      ],
      temperature: 0.4,
      maxTokens: 500,
      validate: parseDebriefJson,
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
