import { useEffect, useMemo, useRef, useState } from 'react'
import { SUGGESTION_MAP } from '../lib/lexicon'
import { useLiveSessionT } from '../i18n'

interface LlmSuggestionInput {
  original: string
  rewrite: string
}

interface ToneSuggestionProps {
  triggerKeyword: string | null
  /** LLM rewrite from /api/rewrite; when present it takes precedence over the keyword map. */
  llmSuggestion?: LlmSuggestionInput | null
}

interface ActiveSuggestion {
  keyword: string
  replacement: string
  isAi?: boolean
}

const DISPLAY_DURATION_MS = 8_000
const AI_DISPLAY_DURATION_MS = 10_000
const MAX_ORIGINAL_DISPLAY_CHARS = 60

export function ToneSuggestion({ triggerKeyword, llmSuggestion = null }: ToneSuggestionProps) {
  const [activeItem, setActiveItem] = useState<ActiveSuggestion | null>(null)
  const [isVisible, setIsVisible] = useState(false)

  const hideTimerRef = useRef<number | null>(null)
  const lastShownRef = useRef<Record<string, number>>({})
  const lastLlmSuggestionRef = useRef<LlmSuggestionInput | null>(null)

  useEffect(() => {
    if (!llmSuggestion || llmSuggestion === lastLlmSuggestionRef.current) {
      return
    }
    lastLlmSuggestionRef.current = llmSuggestion

    const original =
      llmSuggestion.original.length > MAX_ORIGINAL_DISPLAY_CHARS
        ? `${llmSuggestion.original.slice(0, MAX_ORIGINAL_DISPLAY_CHARS)}…`
        : llmSuggestion.original

    const showTimerId = window.setTimeout(() => {
      setActiveItem({ keyword: original, replacement: llmSuggestion.rewrite, isAi: true })
      setIsVisible(true)

      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current)
      }
      hideTimerRef.current = window.setTimeout(() => {
        setIsVisible(false)
      }, AI_DISPLAY_DURATION_MS)
    }, 0)

    return () => {
      window.clearTimeout(showTimerId)
    }
  }, [llmSuggestion])

  useEffect(() => {
    if (!triggerKeyword) {
      return
    }

    const normalized = triggerKeyword.toLowerCase()
    const suggestion = SUGGESTION_MAP[triggerKeyword] || SUGGESTION_MAP[normalized]

    if (!suggestion) {
      return
    }

    const now = Date.now()
    const lastShown = lastShownRef.current[normalized] || 0

    if (now - lastShown < DISPLAY_DURATION_MS) {
      return
    }

    lastShownRef.current[normalized] = now

    const showTimerId = window.setTimeout(() => {
      setActiveItem(suggestion)
      setIsVisible(true)

      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current)
      }

      hideTimerRef.current = window.setTimeout(() => {
        setIsVisible(false)
      }, DISPLAY_DURATION_MS)
    }, 0)

    return () => {
      window.clearTimeout(showTimerId)
    }
  }, [triggerKeyword])

  useEffect(() => {
    return () => {
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current)
      }
    }
  }, [])

  const copy = useLiveSessionT().suggestion

  const containerClassName = useMemo(() => {
    return [
      'rm-static fixed bottom-20 left-1/2 z-40 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 transform transition-all duration-300',
      isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0 pointer-events-none',
    ].join(' ')
  }, [isVisible])

  if (!activeItem) {
    return null
  }

  return (
    <div className={containerClassName}>
      <div className="rounded-card border border-line bg-overlay/95 p-4 shadow-e3 backdrop-blur">
        {activeItem.isAi && (
          <p className="mb-2 inline-block rounded-full border border-brand/40 bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand">
            ✨ {copy.aiBadge}
          </p>
        )}
        <div className="flex items-start gap-3 text-sm">
          <div className="w-1/2 rounded-field border border-tone-hostile/40 bg-tone-hostile/10 p-3">
            <p className="mb-1 text-xs text-tone-hostile">{copy.original}</p>
            <p className="font-semibold text-ink">{activeItem.keyword}</p>
          </div>
          <div className="w-1/2 rounded-field border border-brand/40 bg-brand/10 p-3">
            <p className="mb-1 text-xs text-brand">{copy.suggestion}</p>
            <p className="font-semibold text-ink">{activeItem.replacement}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
