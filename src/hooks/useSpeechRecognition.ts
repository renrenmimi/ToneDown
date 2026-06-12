import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AppLanguage, TranscriptEntry } from '../types/app'

interface SpeechRecognitionAlternativeLike {
  transcript: string
}

interface SpeechRecognitionResultLike {
  isFinal: boolean
  length: number
  [index: number]: SpeechRecognitionAlternativeLike
}

interface SpeechRecognitionResultListLike {
  length: number
  [index: number]: SpeechRecognitionResultLike
}

interface SpeechRecognitionEventLike extends Event {
  resultIndex: number
  results: SpeechRecognitionResultListLike
}

interface SpeechRecognitionErrorEventLike extends Event {
  error: string
  message?: string
}

interface SpeechRecognitionLike extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike

interface SpeechRecognitionWindow extends Window {
  webkitSpeechRecognition?: SpeechRecognitionCtor
  SpeechRecognition?: SpeechRecognitionCtor
}

interface UseSpeechRecognitionOptions {
  /** Controlled by the app so the Groq STT path shares the same language. */
  language: AppLanguage
  /** Finalized utterances, destined for the shared transcript stream. */
  onFinalEntries: (entries: TranscriptEntry[]) => void
  onInterim: (text: string) => void
}

interface UseSpeechRecognitionResult {
  isRecognizing: boolean
  isSupported: boolean
  error: string | null
  start: () => boolean
  stop: () => void
  clearError: () => void
}

const getSpeechRecognitionCtor = (): SpeechRecognitionCtor | null => {
  const speechWindow = window as SpeechRecognitionWindow
  return speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition || null
}

export function isSpeechRecognitionSupported(): boolean {
  return Boolean(getSpeechRecognitionCtor())
}

/**
 * Web Speech API engine. Since the Groq Whisper pipeline became the primary
 * STT path this only runs as the automatic fallback; results flow into the
 * shared transcript stream via callbacks instead of internal state.
 */
export function useSpeechRecognition({
  language,
  onFinalEntries,
  onInterim,
}: UseSpeechRecognitionOptions): UseSpeechRecognitionResult {
  const [isRecognizing, setIsRecognizing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const shouldRestartRef = useRef(false)
  const onFinalEntriesRef = useRef(onFinalEntries)
  const onInterimRef = useRef(onInterim)

  useEffect(() => {
    onFinalEntriesRef.current = onFinalEntries
    onInterimRef.current = onInterim
  }, [onFinalEntries, onInterim])

  const isSupported = useMemo(() => Boolean(getSpeechRecognitionCtor()), [])

  const attachListeners = useCallback((recognition: SpeechRecognitionLike) => {
    recognition.onresult = (event) => {
      const finalSegments: string[] = []
      let interim = ''

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i]
        if (!result || result.length === 0) {
          continue
        }

        const text = result[0]?.transcript?.trim()
        if (!text) {
          continue
        }

        if (result.isFinal) {
          finalSegments.push(text)
        } else {
          interim += `${text} `
        }
      }

      if (finalSegments.length > 0) {
        const now = Date.now()
        onFinalEntriesRef.current(
          finalSegments.map((text, index) => ({
            text,
            timestamp: now + index,
            source: 'browser' as const,
          })),
        )
      }

      onInterimRef.current(interim.trim())
    }

    recognition.onerror = (event) => {
      if (event.error === 'aborted') {
        return
      }

      if (event.error === 'not-allowed') {
        setError('SPEECH_PERMISSION_DENIED')
      } else {
        setError(`SPEECH_${event.error.toUpperCase()}`)
      }
    }

    recognition.onend = () => {
      setIsRecognizing(false)
      onInterimRef.current('')

      if (!shouldRestartRef.current || !recognitionRef.current) {
        return
      }

      window.setTimeout(() => {
        if (!shouldRestartRef.current || !recognitionRef.current) {
          return
        }

        try {
          recognitionRef.current.start()
          setIsRecognizing(true)
        } catch {
          setError('SPEECH_RESTART_FAILED')
        }
      }, 180)
    }
  }, [])

  const start = useCallback(() => {
    if (!isSupported) {
      setError('SPEECH_UNSUPPORTED')
      return false
    }

    const Ctor = getSpeechRecognitionCtor()
    if (!Ctor) {
      setError('SPEECH_UNSUPPORTED')
      return false
    }

    setError(null)
    shouldRestartRef.current = true

    if (!recognitionRef.current) {
      recognitionRef.current = new Ctor()
      recognitionRef.current.continuous = true
      recognitionRef.current.interimResults = true
      attachListeners(recognitionRef.current)
    }

    recognitionRef.current.lang = language

    try {
      recognitionRef.current.start()
      setIsRecognizing(true)
      return true
    } catch (caughtError) {
      const domError = caughtError as DOMException

      if (domError?.name === 'InvalidStateError') {
        setIsRecognizing(true)
        return true
      }

      setError('SPEECH_START_FAILED')
      shouldRestartRef.current = false
      return false
    }
  }, [attachListeners, isSupported, language])

  const stop = useCallback(() => {
    shouldRestartRef.current = false
    onInterimRef.current('')
    setIsRecognizing(false)

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch {
        // No-op: speech recognition may already be stopped.
      }
    }
  }, [])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  useEffect(() => {
    if (!recognitionRef.current) {
      return
    }

    recognitionRef.current.lang = language

    if (isRecognizing) {
      try {
        recognitionRef.current.stop()
      } catch {
        // No-op: recognition may already be in transition.
      }
    }
  }, [isRecognizing, language])

  useEffect(() => {
    return () => {
      shouldRestartRef.current = false

      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch {
          // No-op: unmount cleanup.
        }
      }
    }
  }, [])

  return {
    isRecognizing,
    isSupported,
    error,
    start,
    stop,
    clearError,
  }
}
