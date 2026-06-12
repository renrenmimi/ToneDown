import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { TranscribeResponse } from '../src/types/api'
import { contentLengthWithin, getClientIp, logRequest, requirePost, sendError } from './_lib/http'
import { checkRateLimit } from './_lib/ratelimit'
import { fetchGroq, UpstreamError, WHISPER_MODEL } from './_lib/groq'

const ROUTE = 'transcribe'
const MAX_AUDIO_BYTES = 1.5 * 1024 * 1024
const RATE_LIMIT_PER_MINUTE = 30
const UPSTREAM_TIMEOUT_MS = 9_000

// The client sends raw audio bytes as application/octet-stream (which
// @vercel/node parses to a Buffer) and the real container type in
// x-audio-mime, sidestepping body-parser ambiguity for audio/* types.
const MIME_TO_EXTENSION: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/mp4': 'mp4',
  'audio/wav': 'wav',
  'audio/mpeg': 'mp3',
  'audio/ogg': 'ogg',
}

const LANGUAGE_HINTS = new Set(['zh', 'en'])

// Groq's verbose_json reports full language names; normalize the common ones
// to ISO-639-1 so the client gets stable codes.
const LANGUAGE_NAME_TO_CODE: Record<string, string> = {
  chinese: 'zh',
  mandarin: 'zh',
  english: 'en',
}

function normalizeLanguage(raw: string): string {
  const lower = raw.trim().toLowerCase()
  return LANGUAGE_NAME_TO_CODE[lower] ?? lower
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

  if (!contentLengthWithin(req, MAX_AUDIO_BYTES)) {
    sendError(res, 413, 'PAYLOAD_TOO_LARGE')
    return finish(413)
  }

  const contentTypeHeader = req.headers['content-type'] ?? ''
  if (!contentTypeHeader.includes('application/octet-stream')) {
    sendError(res, 415, 'EXPECTED_OCTET_STREAM')
    return finish(415)
  }

  const mimeHeader = req.headers['x-audio-mime']
  const mime = (Array.isArray(mimeHeader) ? mimeHeader[0] : mimeHeader) ?? 'audio/webm'
  const baseMime = mime.split(';')[0].trim()
  const extension = MIME_TO_EXTENSION[baseMime]
  if (!extension) {
    sendError(res, 415, 'UNSUPPORTED_AUDIO_MIME')
    return finish(415)
  }

  const body: unknown = req.body
  if (!(body instanceof Uint8Array) || body.byteLength === 0) {
    sendError(res, 400, 'EMPTY_AUDIO_BODY')
    return finish(400)
  }
  if (body.byteLength > MAX_AUDIO_BYTES) {
    sendError(res, 413, 'PAYLOAD_TOO_LARGE')
    return finish(413)
  }

  const langParam = Array.isArray(req.query.lang) ? req.query.lang[0] : req.query.lang

  const form = new FormData()
  form.append('file', new Blob([new Uint8Array(body)], { type: baseMime }), `segment.${extension}`)
  form.append('model', WHISPER_MODEL)
  form.append('response_format', 'verbose_json')
  form.append('temperature', '0')
  if (langParam && LANGUAGE_HINTS.has(langParam)) {
    form.append('language', langParam)
  }

  try {
    const response = await fetchGroq(
      '/audio/transcriptions',
      { method: 'POST', body: form },
      UPSTREAM_TIMEOUT_MS,
    )
    const data = (await response.json()) as { text?: string; language?: string }

    const payload: TranscribeResponse = {
      transcript: (data.text ?? '').trim(),
      language: normalizeLanguage(data.language ?? ''),
    }
    res.status(200).json(payload)
    return finish(200)
  } catch (error) {
    const status = error instanceof UpstreamError ? error.status : 502
    const code = error instanceof UpstreamError ? error.message : 'UPSTREAM_ERROR'
    sendError(res, status, code)
    return finish(status)
  }
}
