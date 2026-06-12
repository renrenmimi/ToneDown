import { useCallback, useEffect, useRef, useState } from 'react'
import { pickMimeType } from '@/features/live-session/lib/sttFilters'
import { toLanguageHint, transcribeEndpoint } from '@/shared/llm/endpoints'
import type { Locale } from '@/shared/i18n/localeContext'

const MAX_HOLD_MS = 15_000

export type HoldToTalkStatus = 'idle' | 'recording' | 'transcribing' | 'unavailable'

/**
 * Push-to-talk for sparring: records while held (own short-lived mic stream,
 * released immediately after), transcribes via the existing Groq endpoint,
 * and hands the text back for the user to edit before sending. Falls back to
 * 'unavailable' (button hidden) when mic/MediaRecorder/permission are absent.
 */
export function useHoldToTalk(locale: Locale, onText: (text: string) => void) {
  const [status, setStatus] = useState<HoldToTalkStatus>(() =>
    pickMimeType() === null ? 'unavailable' : 'idle',
  )

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<number | null>(null)
  const onTextRef = useRef(onText)
  useEffect(() => {
    onTextRef.current = onText
  }, [onText])

  const cleanup = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    recorderRef.current = null
  }, [])

  useEffect(() => cleanup, [cleanup])

  const stop = useCallback(() => {
    const recorder = recorderRef.current
    if (recorder && recorder.state === 'recording') {
      recorder.stop()
    }
  }, [])

  const start = useCallback(async () => {
    if (status === 'recording' || status === 'transcribing' || status === 'unavailable') {
      return
    }
    const mimeType = pickMimeType()
    if (!mimeType || !transcribeEndpoint.canAttempt()) {
      return
    }

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setStatus('unavailable')
      return
    }

    streamRef.current = stream
    const recorder = new MediaRecorder(stream, { mimeType })
    recorderRef.current = recorder
    const chunks: Blob[] = []

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data)
      }
    }
    recorder.onstop = () => {
      cleanup()
      const blob = new Blob(chunks, { type: mimeType })
      if (blob.size === 0) {
        setStatus('idle')
        return
      }
      setStatus('transcribing')
      void transcribeEndpoint
        .call({ audio: blob, mime: mimeType, langHint: toLanguageHint(locale) })
        .then((result) => {
          const text = result.transcript.trim()
          if (text.length > 0) {
            onTextRef.current(text)
          }
        })
        .catch(() => {
          // Text input remains the fallback.
        })
        .finally(() => {
          setStatus('idle')
        })
    }

    recorder.start()
    setStatus('recording')
    timerRef.current = window.setTimeout(stop, MAX_HOLD_MS)
  }, [cleanup, locale, status, stop])

  return { status, start, stop }
}
