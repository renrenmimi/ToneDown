import { useEffect, useMemo, useRef, useState } from 'react'
import type { AppLanguage } from '../types/app'

interface LlmSuggestionInput {
  original: string
  rewrite: string
}

interface ToneSuggestionProps {
  triggerKeyword: string | null
  /** LLM rewrite from /api/rewrite; when present it takes precedence over the keyword map. */
  llmSuggestion?: LlmSuggestionInput | null
  language: AppLanguage
}

interface SuggestionItem {
  keyword: string
  replacement: string
  isAi?: boolean
}

const DISPLAY_DURATION_MS = 8_000
const AI_DISPLAY_DURATION_MS = 10_000
const MAX_ORIGINAL_DISPLAY_CHARS = 60

const SUGGESTION_MAP: Record<string, SuggestionItem> = {
  你总是: { keyword: '你总是…', replacement: '我注意到有时候会…' },
  你从来不: { keyword: '你从来不…', replacement: '我希望我们能更多地…' },
  你怎么又: { keyword: '你怎么又…', replacement: '这件事对我来说很重要…' },
  烦死了: { keyword: '烦死了', replacement: '我现在有点不舒服，需要一点空间' },
  别说了: { keyword: '别说了', replacement: '我需要一点时间来整理思绪' },
  你就不能: { keyword: '你就不能…', replacement: '如果你能…我会很感激' },
  'you always': {
    keyword: 'you always',
    replacement: "Try saying: I've noticed that sometimes...",
  },
  'you never': {
    keyword: 'you never',
    replacement: 'Try saying: I wish we could more often...',
  },
  'shut up': {
    keyword: 'shut up',
    replacement: 'Try saying: I need a moment to collect my thoughts',
  },
  whatever: {
    keyword: 'whatever',
    replacement: "Try saying: I'm feeling frustrated and need a break",
  },
  "i'm done": {
    keyword: "I'm done",
    replacement: 'Try saying: I am feeling overwhelmed right now',
  },
}

const COPY: Record<AppLanguage, { original: string; suggestion: string; aiBadge: string }> = {
  'zh-CN': { original: '原话', suggestion: '建议', aiBadge: 'AI 建议' },
  'en-US': { original: 'Original', suggestion: 'Suggestion', aiBadge: 'AI suggestion' },
}

export function ToneSuggestion({ triggerKeyword, llmSuggestion = null, language }: ToneSuggestionProps) {
  const [activeItem, setActiveItem] = useState<SuggestionItem | null>(null)
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

  const copy = COPY[language]

  const containerClassName = useMemo(() => {
    return [
      'fixed bottom-4 left-1/2 z-40 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 transform transition-all duration-300',
      isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0 pointer-events-none',
    ].join(' ')
  }, [isVisible])

  if (!activeItem) {
    return null
  }

  return (
    <div className={containerClassName}>
      <div className="rounded-2xl border border-slate-700 bg-slate-900/95 p-4 shadow-2xl backdrop-blur">
        {activeItem.isAi && (
          <p className="mb-2 inline-block rounded-full border border-violet-400/40 bg-violet-500/10 px-2 py-0.5 text-xs font-semibold text-violet-200">
            ✨ {copy.aiBadge}
          </p>
        )}
        <div className="flex items-start gap-3 text-sm">
          <div className="w-1/2 rounded-xl border border-red-500/40 bg-red-500/10 p-3">
            <p className="mb-1 text-xs text-red-300">{copy.original}</p>
            <p className="font-semibold text-red-200">{activeItem.keyword}</p>
          </div>
          <div className="w-1/2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3">
            <p className="mb-1 text-xs text-emerald-300">{copy.suggestion}</p>
            <p className="font-semibold text-emerald-100">{activeItem.replacement}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
