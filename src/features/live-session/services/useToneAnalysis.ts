import { useEffect, useRef, useState } from 'react'
import { getBreaker } from '@/shared/llm/breakers'
import { getSnapshot, precheck } from '@/shared/llm/budget'
import { analyzeEndpoint } from '@/shared/llm/endpoints'
import type { AppLanguage, LlmToneResult, TranscriptEntry } from '@/types/app'
import { sessionStore } from '../machine/sessionStore'

// Runs on its own cadence (each newly finalized transcript entry), decoupled
// from the 2s scoring loop, which only ever reads the latest result.
const DEBOUNCE_MS = 600
const MIN_TEXT_CHARS = 3
const CONTEXT_WINDOW_MS = 45_000
const MAX_CONTEXT_ENTRIES = 6

// --- Adaptive cadence (budget engineering) ---
// Heated moments deserve every segment; calm stretches can coast. The
// fusion's 20s freshness decay makes stretched cadence safe by design.
const HEATED_SCORE = 55
const CALM_SKIP = 2 // analyze every 2nd entry when calm
const LOW_BUDGET_SKIP = 3 // every 3rd when the bucket is below half
const LOW_BUDGET_PCT = 0.5
const CRITICAL_BUDGET_PCT = 0.15
const CRITICAL_MIN_GAP_MS = 20_000

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
  const entriesSinceAnalyzeRef = useRef(0)
  const lastAnalyzeAtRef = useRef(0)
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

      const now = Date.now()

      // Budget exhausted is a *designed* state: flip the chip to rules mode
      // honestly (distinct from a breaker probe window, which stays quiet).
      if (!precheck('live-analyze', 0, now).allowed) {
        setAvailable(false)
        return
      }
      // While the breaker is open, entries keep arriving but only the
      // post-backoff one becomes the half-open probe (endpoint admits it).
      if (!analyzeEndpoint.canAttempt()) {
        return
      }

      // Adaptive cadence: every entry while heated; every 2nd when calm
      // (3rd below half budget); 20s floor when the bucket runs critical.
      entriesSinceAnalyzeRef.current += 1
      const score = sessionStore.getState().score
      const snapshot = getSnapshot('live-analyze', now)
      const usedPct = snapshot.tokenBudget > 0 ? snapshot.tokensUsed / snapshot.tokenBudget : 0
      const skip =
        score >= HEATED_SCORE ? 1 : usedPct >= LOW_BUDGET_PCT ? LOW_BUDGET_SKIP : CALM_SKIP
      if (entriesSinceAnalyzeRef.current < skip) {
        return
      }
      if (1 - usedPct <= CRITICAL_BUDGET_PCT && now - lastAnalyzeAtRef.current < CRITICAL_MIN_GAP_MS) {
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
      entriesSinceAnalyzeRef.current = 0
      lastAnalyzeAtRef.current = now

      void analyzeEndpoint
        .call({ text, context, language: languageRef.current })
        .then((result) => {
          setAvailable(true)
          setLatest({ ...result, at: Date.now() })
        })
        .catch(() => {
          setAvailable(getBreaker('analyze').state === 'closed')
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
