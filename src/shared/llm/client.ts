import { recordLatency, type LatencyStage } from '@/shared/latencyLog'
import { getBreaker, type BreakerName } from './breakers'
import * as budget from './budget'
import { ApiCallError, BreakerOpenError, BudgetExceededError } from './errors'

// THE single path for every LLM-backed call: budget pre-check -> circuit
// breaker -> AbortController timeout -> shape validation -> bookkeeping
// (breaker, budget, latency). Feature code never touches fetch directly.

export interface EncodedRequest {
  body: BodyInit
  headers: Record<string, string>
  /** Appended to the path, e.g. '?lang=zh'. */
  query?: string
}

export interface EndpointSpec<TReq, TRes> {
  path: `/api/${string}`
  timeoutMs: number
  breaker: BreakerName
  feature: budget.FeatureId
  latencyStage: LatencyStage
  estimateTokens: (req: TReq) => number
  /** Audio seconds billed against the whisper pool (transcribe only). */
  audioSeconds?: (req: TReq) => number
  encode: (req: TReq) => EncodedRequest
  validate: (data: unknown) => TRes | null
}

export interface Endpoint<TReq, TRes> {
  call(req: TReq): Promise<TRes>
  /** Pre-flight check (breaker + budget) so callers can skip work early. */
  canAttempt(): boolean
}

export function createEndpoint<TReq, TRes>(spec: EndpointSpec<TReq, TRes>): Endpoint<TReq, TRes> {
  const breaker = getBreaker(spec.breaker)

  return {
    canAttempt(): boolean {
      return breaker.canAttempt() && budget.precheck(spec.feature, 0).allowed
    },

    async call(req: TReq): Promise<TRes> {
      const estimatedTokens = spec.estimateTokens(req)

      const decision = budget.precheck(spec.feature, estimatedTokens)
      if (!decision.allowed) {
        throw new BudgetExceededError(spec.feature)
      }
      // beginAttempt, not canAttempt: this is the point where a request really
      // goes out, so this is where the half-open probe slot gets reserved.
      if (!breaker.beginAttempt()) {
        throw new BreakerOpenError(spec.breaker)
      }

      const encoded = spec.encode(req)
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), spec.timeoutMs)
      const startedAt = performance.now()

      let response: Response
      try {
        response = await fetch(`${spec.path}${encoded.query ?? ''}`, {
          method: 'POST',
          headers: encoded.headers,
          body: encoded.body,
          signal: controller.signal,
        })
      } catch (error) {
        breaker.recordFailure()
        if (error instanceof Error && error.name === 'AbortError') {
          throw new ApiCallError(0, 'TIMEOUT')
        }
        throw new ApiCallError(0, 'NETWORK_ERROR')
      } finally {
        clearTimeout(timer)
      }

      if (!response.ok) {
        breaker.recordFailure()
        if (response.status === 429) {
          const retryAfter = Number(response.headers.get('Retry-After'))
          budget.suspend(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 60)
        }
        throw new ApiCallError(response.status, `HTTP_${response.status}`)
      }

      const data: unknown = await response.json().catch(() => null)
      const parsed = spec.validate(data)
      if (parsed === null) {
        breaker.recordFailure()
        throw new ApiCallError(0, 'BAD_RESPONSE_SHAPE')
      }

      breaker.recordSuccess()
      budget.record(spec.feature, estimatedTokens, {
        audioSeconds: spec.audioSeconds?.(req),
      })
      recordLatency(spec.latencyStage, performance.now() - startedAt)

      return parsed
    },
  }
}
