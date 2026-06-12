// Per-IP sliding-window rate limiter.
//
// Caveat (intentional): state lives in module memory, so the limit applies
// per warm serverless instance — concurrent bursts that land on different
// instances each get a fresh window, and state resets on cold start. That is
// acceptable "basic abuse protection" for a public demo without adding an
// external store; it stops sustained hammering of the Groq quota from one IP.

const WINDOW_MS = 60_000
const MAX_TRACKED_IPS = 2_000

const buckets = new Map<string, number[]>()

export interface RateLimitResult {
  ok: boolean
  /** Seconds until a slot frees up. Only set when ok === false. */
  retryAfter?: number
}

export function checkRateLimit(route: string, ip: string, maxRequests: number): RateLimitResult {
  const key = `${route}:${ip}`
  const now = Date.now()
  const cutoff = now - WINDOW_MS

  const timestamps = (buckets.get(key) ?? []).filter((t) => t > cutoff)

  if (timestamps.length >= maxRequests) {
    buckets.set(key, timestamps)
    const oldest = timestamps[0]
    return { ok: false, retryAfter: Math.max(1, Math.ceil((oldest + WINDOW_MS - now) / 1000)) }
  }

  timestamps.push(now)
  // Re-inserting moves the key to the end of the Map's insertion order,
  // so eviction below drops the least-recently-active IP.
  buckets.delete(key)
  buckets.set(key, timestamps)

  if (buckets.size > MAX_TRACKED_IPS) {
    const eldest = buckets.keys().next().value
    if (eldest !== undefined) {
      buckets.delete(eldest)
    }
  }

  return { ok: true }
}
