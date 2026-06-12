import { useCallback, useState } from 'react'
import type { TranscriptEntry } from '../types/app'

const MAX_TRANSCRIPT_ENTRIES = 600

interface UseTranscriptStreamResult {
  entries: TranscriptEntry[]
  interim: string
  addFinal: (newEntries: TranscriptEntry[]) => void
  setInterim: (text: string) => void
  clear: () => void
}

/**
 * Canonical transcript store. Both STT engines (Groq Whisper segments and the
 * Web Speech fallback) feed finalized entries here, so downstream consumers
 * (speech rate, emotion detector, transcript UI) see one stream regardless of
 * which engine is active.
 */
export function useTranscriptStream(): UseTranscriptStreamResult {
  const [entries, setEntries] = useState<TranscriptEntry[]>([])
  const [interim, setInterim] = useState('')

  const addFinal = useCallback((newEntries: TranscriptEntry[]) => {
    if (newEntries.length === 0) {
      return
    }
    setEntries((prev) => {
      const next = [...prev, ...newEntries]
      if (next.length > MAX_TRANSCRIPT_ENTRIES) {
        return next.slice(next.length - MAX_TRANSCRIPT_ENTRIES)
      }
      return next
    })
  }, [])

  const clear = useCallback(() => {
    setEntries([])
    setInterim('')
  }, [])

  return { entries, interim, addFinal, setInterim, clear }
}
