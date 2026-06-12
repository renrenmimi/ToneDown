import { useEffect, useRef, useState } from 'react'
import { rewriteEndpoint } from '@/shared/llm/endpoints'
import { sessionStore } from '../machine/sessionStore'
import type { AppLanguage, TranscriptEntry } from '@/types/app'

// Sustained hostility mirrors CalmReminder's trigger (score >= 70 held 5s);
// a fresh high-risk keyword triggers immediately. Both share one cooldown.
const SCORE_THRESHOLD = 70
const SUSTAIN_MS = 5_000
const CHECK_INTERVAL_MS = 1_000
const COOLDOWN_MS = 45_000
const MIN_UTTERANCE_CHARS = 4
const CONTEXT_WINDOW_MS = 45_000
const MAX_CONTEXT_ENTRIES = 6

export interface LlmSuggestion {
  original: string
  rewrite: string
}

interface UseRewriteSuggestionArgs {
  score: number
  latestHighRiskKeyword: string | null
  entries: TranscriptEntry[]
  language: AppLanguage
  isActive: boolean
}

interface UseRewriteSuggestionResult {
  /** Null when no rewrite is ready (or the API failed): callers fall back to SUGGESTION_MAP. */
  suggestion: LlmSuggestion | null
}

export function useRewriteSuggestion({
  score,
  latestHighRiskKeyword,
  entries,
  language,
  isActive,
}: UseRewriteSuggestionArgs): UseRewriteSuggestionResult {
  const [suggestion, setSuggestion] = useState<LlmSuggestion | null>(null)

  const scoreRef = useRef(score)
  const entriesRef = useRef(entries)
  const languageRef = useRef(language)
  const hostileSinceRef = useRef<number | null>(null)
  const lastTriggeredAtRef = useRef(0)
  const lastUtteranceRef = useRef('')
  const inFlightRef = useRef(false)

  useEffect(() => {
    scoreRef.current = score
    entriesRef.current = entries
    languageRef.current = language
  }, [entries, language, score])

  useEffect(() => {
    if (!isActive) {
      hostileSinceRef.current = null
      return
    }

    const requestRewrite = () => {
      const now = Date.now()
      if (inFlightRef.current || now - lastTriggeredAtRef.current < COOLDOWN_MS) {
        return
      }
      // Open breaker / exhausted budget: skip entirely; ToneSuggestion's
      // keyword map is the fallback, so hostile moments still get a
      // (static) suggestion.
      if (!rewriteEndpoint.canAttempt()) {
        return
      }

      const allEntries = entriesRef.current
      const newest = allEntries[allEntries.length - 1]
      if (!newest) {
        return
      }
      const utterance = newest.text.trim()
      if (utterance.length < MIN_UTTERANCE_CHARS || utterance === lastUtteranceRef.current) {
        return
      }

      const context = allEntries
        .filter(
          (entry) =>
            entry.timestamp !== newest.timestamp && entry.timestamp >= now - CONTEXT_WINDOW_MS,
        )
        .slice(-MAX_CONTEXT_ENTRIES)
        .map((entry) => entry.text)

      inFlightRef.current = true
      lastTriggeredAtRef.current = now
      lastUtteranceRef.current = utterance

      void rewriteEndpoint
        .call({ utterance, context, language: languageRef.current })
        .then((result) => {
          setSuggestion({ original: utterance, rewrite: result.rewrite })
          sessionStore.dispatch({
            type: 'REWRITE_OFFERED',
            moment: { at: Date.now(), quote: utterance, rewrite: result.rewrite },
          })
        })
        .catch(() => {
          // Leave suggestion null/stale: ToneSuggestion's keyword map takes over.
        })
        .finally(() => {
          inFlightRef.current = false
        })
    }

    // Fresh session: drop any leftover suggestion from the previous one
    // (async to satisfy react-hooks/set-state-in-effect).
    const resetTimerId = window.setTimeout(() => {
      setSuggestion(null)
      lastUtteranceRef.current = ''
    }, 0)

    const timerId = window.setInterval(() => {
      const now = Date.now()
      if (scoreRef.current >= SCORE_THRESHOLD) {
        if (hostileSinceRef.current === null) {
          hostileSinceRef.current = now
        } else if (now - hostileSinceRef.current >= SUSTAIN_MS) {
          requestRewrite()
        }
      } else {
        hostileSinceRef.current = null
      }
    }, CHECK_INTERVAL_MS)

    return () => {
      window.clearTimeout(resetTimerId)
      window.clearInterval(timerId)
    }
  }, [isActive])

  // A newly detected high-risk keyword is a strong enough signal to skip the
  // 5s sustain window (still subject to the shared cooldown).
  const keywordTriggerRef = useRef<string | null>(null)
  useEffect(() => {
    if (!isActive || !latestHighRiskKeyword) {
      keywordTriggerRef.current = latestHighRiskKeyword
      return
    }
    if (latestHighRiskKeyword === keywordTriggerRef.current) {
      return
    }
    keywordTriggerRef.current = latestHighRiskKeyword
    hostileSinceRef.current = Date.now() - SUSTAIN_MS
  }, [isActive, latestHighRiskKeyword])

  return { suggestion: isActive ? suggestion : null }
}
