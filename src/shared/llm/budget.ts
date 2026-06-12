// Client-side daily token/request meter against the Groq free tier
// (llama-3.3-70b: 100K tokens/day is the binding org-level constraint).
//
// Honesty note: this is advisory self-throttling per device. The server's
// per-IP rate limits and Groq's own 429s (handled by the circuit breakers)
// remain the enforcement; this meter exists so a normal day of use never
// gets near them, and so the UI can warn before the cliff.
//
// OBSERVE-ONLY for now: precheck() never blocks, it only records what it
// WOULD have decided. The enforcement flip (M5) happens after a week of
// recorded real numbers validates the bucket constants.

export type FeatureId =
  | 'live-transcribe'
  | 'live-analyze'
  | 'live-rewrite'
  | 'debrief'
  | 'sparring'
  | 'gym'

const ENFORCE = false

// Token buckets sum to 82K of the 100K TPD — ~18% headroom for estimation
// error and other visitors sharing the org quota.
export const DAILY_TOKEN_BUDGETS: Record<FeatureId, number> = {
  'live-transcribe': 0, // whisper bills audio seconds, not tokens
  'live-analyze': 40_000,
  'live-rewrite': 5_000,
  debrief: 9_000,
  sparring: 24_000,
  gym: 4_000,
}

export const DAILY_REQUEST_CAPS: Record<FeatureId, number> = {
  'live-transcribe': 1_500, // whisper free tier: 2,000 RPD
  'live-analyze': 600,
  'live-rewrite': 40,
  debrief: 12,
  sparring: 120,
  gym: 40,
}

const STORAGE_KEY = 'tonedown.budget.v1'

interface BucketState {
  requests: number
  tokens: number
}

interface BudgetState {
  day: string
  buckets: Partial<Record<FeatureId, BucketState>>
  audioSeconds: number
  /** Epoch ms until which all spending is suspended (set on upstream 429). */
  suspendedUntil: number
}

export interface BudgetDecision {
  allowed: boolean
  reason: 'ok' | 'tokens' | 'requests' | 'suspended'
}

export interface BudgetSnapshot {
  tokensUsed: number
  tokenBudget: number
  requestsUsed: number
  requestCap: number
  exhausted: boolean
}

type Listener = () => void
const listeners = new Set<Listener>()

function localDay(now: number): string {
  const d = new Date(now)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function emptyState(now: number): BudgetState {
  return { day: localDay(now), buckets: {}, audioSeconds: 0, suspendedUntil: 0 }
}

function load(now: number): BudgetState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as BudgetState
      if (parsed && parsed.day === localDay(now)) {
        return parsed
      }
    }
  } catch {
    // Corrupt or unavailable storage: start fresh.
  }
  return emptyState(now)
}

function save(state: BudgetState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Non-persistent metering still works within the tab via the cache below.
  }
  for (const listener of listeners) {
    listener()
  }
}

// In-memory cache so a storage failure doesn't disable metering entirely.
let cached: BudgetState | null = null

function getState(now: number): BudgetState {
  if (!cached || cached.day !== localDay(now)) {
    cached = load(now)
  }
  return cached
}

function bucket(state: BudgetState, feature: FeatureId): BucketState {
  const existing = state.buckets[feature]
  if (existing) {
    return existing
  }
  const fresh: BucketState = { requests: 0, tokens: 0 }
  state.buckets[feature] = fresh
  return fresh
}

function decide(state: BudgetState, feature: FeatureId, tokens: number, now: number): BudgetDecision {
  if (now < state.suspendedUntil) {
    return { allowed: false, reason: 'suspended' }
  }
  const b = bucket(state, feature)
  if (b.requests + 1 > DAILY_REQUEST_CAPS[feature]) {
    return { allowed: false, reason: 'requests' }
  }
  const tokenBudget = DAILY_TOKEN_BUDGETS[feature]
  if (tokenBudget > 0 && b.tokens + tokens > tokenBudget) {
    return { allowed: false, reason: 'tokens' }
  }
  return { allowed: true, reason: 'ok' }
}

/**
 * Consult BEFORE calling. In observe-only mode this always allows but logs
 * would-be denials so the M5 enforcement flip is grounded in real data.
 */
export function precheck(feature: FeatureId, estimatedTokens: number, now = Date.now()): BudgetDecision {
  const decision = decide(getState(now), feature, estimatedTokens, now)
  if (!decision.allowed && !ENFORCE) {
    if (import.meta.env.DEV) {
      console.debug(`[budget] observe-only: would block ${feature} (${decision.reason})`)
    }
    return { allowed: true, reason: decision.reason }
  }
  return decision
}

export function record(
  feature: FeatureId,
  tokens: number,
  options: { audioSeconds?: number } = {},
  now = Date.now(),
): void {
  const state = getState(now)
  const b = bucket(state, feature)
  b.requests += 1
  b.tokens += tokens
  if (options.audioSeconds) {
    state.audioSeconds += options.audioSeconds
  }
  save(state)
}

/** Upstream 429: pause all spending for the advertised window. */
export function suspend(retryAfterSeconds: number, now = Date.now()): void {
  const state = getState(now)
  state.suspendedUntil = Math.max(state.suspendedUntil, now + retryAfterSeconds * 1_000)
  save(state)
}

export function getSnapshot(feature: FeatureId, now = Date.now()): BudgetSnapshot {
  const state = getState(now)
  const b = state.buckets[feature] ?? { requests: 0, tokens: 0 }
  const tokenBudget = DAILY_TOKEN_BUDGETS[feature]
  const requestCap = DAILY_REQUEST_CAPS[feature]
  return {
    tokensUsed: b.tokens,
    tokenBudget,
    requestsUsed: b.requests,
    requestCap,
    exhausted:
      ENFORCE &&
      !decide(state, feature, 0, now).allowed,
  }
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Test-only: reset in-memory cache. */
export function resetBudgetForTest(): void {
  cached = null
  listeners.clear()
}
