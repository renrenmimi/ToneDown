import { useEffect, useRef, useState } from 'react'
import { analyze } from '../lib/apiClient'
import { CircuitBreaker } from '@/shared/circuitBreaker'
import { recordLatency } from '@/shared/latencyLog'
import type { AppLanguage, LlmToneResult, TranscriptEntry } from '../types/app'

// Runs on its own cadence (each newly finalized transcript entry), decoupled
// from the 2s scoring loop, which only ever reads the latest result.
const DEBOUNCE_MS = 600
const MIN_TEXT_CHARS = 3
const CONTEXT_WINDOW_MS = 45_000
const MAX_CONTEXT_ENTRIES = 6

interface UseToneAnalysisArgs {
  entries: TranscriptEntry[]
  language: AppLanguage
  isActive: boolean
}

interface UseToneAnalysisResult {
  latest: LlmToneResult | null
  /** False after repeated /api/analyze failures: scoring falls back to local rules. */
  available: boolean
}

export function useToneAnalysis({
  entries,
  language,
  isActive,
}: UseToneAnalysisArgs): UseToneAnalysisResult {
  const [latest, setLatest] = useState<LlmToneResult | null>(null)
  const [available, setAvailable] = useState(true)

  const languageRef = useRef(language)
  const lastSeenTimestampRef = useRef(0)
  const inFlightRef = useRef(false)
  // The breaker survives stop/start: a flapping endpoint stays backed off.
  const breakerRef = useRef(new CircuitBreaker())
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    languageRef.current = language
  }, [language])

  useEffect(() => {
    if (!isActive) {
      lastSeenTimestampRef.current = 0
      return
    }

    const newest = entries[entries.length - 1]
    if (!newest || newest.timestamp <= lastSeenTimestampRef.current) {
      return
    }
    lastSeenTimestampRef.current = newest.timestamp

    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current)
    }

    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null

      if (inFlightRef.current) {
        // Coalesce: the next finalized entry re-triggers; skipping one window
        // beats queueing stale analyses behind a slow request.
        return
      }

      const breaker = breakerRef.current
      const now = Date.now()
      // While open, entries keep arriving but only the post-backoff one
      // becomes the half-open probe.
      if (!breaker.canAttempt(now)) {
        return
      }

      const text = newest.text.trim()
      if (text.length < MIN_TEXT_CHARS) {
        return
      }

      const context = entries
        .filter(
          (entry) => entry.timestamp !== newest.timestamp && entry.timestamp >= now - CONTEXT_WINDOW_MS,
        )
        .slice(-MAX_CONTEXT_ENTRIES)
        .map((entry) => entry.text)

      inFlightRef.current = true
      const startedAt = performance.now()

      void analyze({ text, context, language: languageRef.current })
        .then((result) => {
          recordLatency('analyze', performance.now() - startedAt)
          breaker.recordSuccess()
          setAvailable(true)
          setLatest({ ...result, at: Date.now() })
        })
        .catch(() => {
          breaker.recordFailure()
          setAvailable(breaker.state === 'closed')
        })
        .finally(() => {
          inFlightRef.current = false
        })
    }, DEBOUNCE_MS)
  }, [entries, isActive])

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  return { latest, available }
}
