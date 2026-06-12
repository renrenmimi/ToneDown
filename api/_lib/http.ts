import type { VercelRequest, VercelResponse } from '@vercel/node'

// Shared HTTP plumbing for the API routes. Privacy rule for this whole
// directory: never log headers, bodies, transcripts, or env values —
// request logs are route/status/duration only.

export function sendError(
  res: VercelResponse,
  status: number,
  error: string,
  retryAfter?: number,
): void {
  if (retryAfter !== undefined) {
    res.setHeader('Retry-After', String(retryAfter))
  }
  res.status(status).json(retryAfter !== undefined ? { error, retryAfter } : { error })
}

export function requirePost(req: VercelRequest, res: VercelResponse): boolean {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    sendError(res, 405, 'METHOD_NOT_ALLOWED')
    return false
  }
  return true
}

export function getClientIp(req: VercelRequest): string {
  const forwarded = req.headers['x-forwarded-for']
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded
  if (first) {
    return first.split(',')[0].trim()
  }
  return req.socket?.remoteAddress ?? 'unknown'
}

export function contentLengthWithin(req: VercelRequest, maxBytes: number): boolean {
  const header = req.headers['content-length']
  const length = Number(Array.isArray(header) ? header[0] : header)
  return !Number.isFinite(length) || length <= maxBytes
}

export function logRequest(route: string, status: number, startedAt: number): void {
  console.log(JSON.stringify({ route, status, durationMs: Date.now() - startedAt }))
}
