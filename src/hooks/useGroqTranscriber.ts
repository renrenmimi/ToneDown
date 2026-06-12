import { useEffect, useMemo, useRef, useState } from 'react'
import { transcribe, toLanguageHint } from '../lib/apiClient'
import type { AppLanguage, SttEngine, TranscriptEntry } from '../types/app'

// Segment length tradeoff: Whisper accuracy degrades (and hallucination odds
// rise) below ~2-3s of audio, while longer segments lag the 2s scoring loop.
// 4s ≈ 15 requests/min, comfortably inside the 30/min server rate limit.
const SEGMENT_MS = 4_000
const VOLUME_SAMPLE_MS = 100
const MAX_CONSECUTIVE_FAILURES = 3
const PROBE_INTERVAL_MS = 60_000

// Silence gate: segments quieter than this are dropped without uploading.
// Saves Groq quota and is the primary defense against Whisper hallucinating
// text on silence (observed live: near-silent audio with a zh hint reliably
// produced "请不吝点赞 订阅 转发 …").
const SILENCE_MEAN_THRESHOLD = 5
const SILENCE_PEAK_THRESHOLD = 12

// Known Whisper silence hallucinations, matched against the whole trimmed result.
const HALLUCINATION_PATTERNS: RegExp[] = [
  /^(thank you|thanks|thank you for watching|thanks for watching|please subscribe|bye)[.!\s]*$/i,
  /字幕由.*提供/,
  /请不吝点赞/,
  /谢谢(大家)?(观看|收看)/,
  /明镜与点点/,
  /amara\.org/i,
]

const QUIET_PEAK_THRESHOLD = 15
const QUIET_MIN_TEXT_LENGTH = 5

function pickMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined') {
    return null
  }
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
  return candidates.find((mime) => MediaRecorder.isTypeSupported(mime)) ?? null
}

function filterTranscript(raw: string, peakVolume: number): string | null {
  const text = raw.trim()
  if (text.length === 0) {
    return null
  }
  if (HALLUCINATION_PATTERNS.some((pattern) => pattern.test(text))) {
    return null
  }
  // A near-silent segment that still produced a tiny result is almost
  // certainly noise rather than speech.
  if (peakVolume < QUIET_PEAK_THRESHOLD && text.length < QUIET_MIN_TEXT_LENGTH) {
    return null
  }
  return text
}

interface UseGroqTranscriberArgs {
  mediaStream: MediaStream | null
  volume: number
  isActive: boolean
  language: AppLanguage
  onFinalEntries: (entries: TranscriptEntry[]) => void
}

interface UseGroqTranscriberResult {
  /** Which STT engine should currently be feeding the transcript. */
  engine: SttEngine
  /** Wall time from segment stop to committed transcript for the last upload. */
  lastLatencyMs: number | null
}

/**
 * Primary STT path: records ~4s audio segments from the shared mic stream and
 * sends them to /api/transcribe (Groq Whisper).
 *
 * MediaRecorder.start(timeslice) is deliberately NOT used — only the first
 * chunk carries the container header, so later chunks are not independently
 * decodable. Instead each segment gets a fresh MediaRecorder; at the boundary
 * the next recorder starts before the current one stops, so a few ms of
 * overlap replaces word clipping.
 *
 * After 3 consecutive upload failures the hook reports engine='browser' (the
 * caller starts Web Speech) and switches to a 60s recovery probe: one segment
 * per minute is uploaded, its text discarded (Web Speech already transcribed
 * that audio); on success the continuous loop resumes.
 */
export function useGroqTranscriber({
  mediaStream,
  volume,
  isActive,
  language,
  onFinalEntries,
}: UseGroqTranscriberArgs): UseGroqTranscriberResult {
  const [degraded, setDegraded] = useState(false)
  const [lastLatencyMs, setLastLatencyMs] = useState<number | null>(null)

  const mimeType = useMemo(() => pickMimeType(), [])

  // No MediaRecorder support (Safari < 14, etc.) means permanent fallback;
  // otherwise the engine is 'browser' only while a monitoring session is degraded.
  const engine: SttEngine = mimeType === null || (isActive && degraded) ? 'browser' : 'groq'

  const volumeRef = useRef(volume)
  const languageRef = useRef(language)
  const onFinalEntriesRef = useRef(onFinalEntries)

  useEffect(() => {
    volumeRef.current = volume
    languageRef.current = language
    onFinalEntriesRef.current = onFinalEntries
  }, [language, onFinalEntries, volume])

  useEffect(() => {
    if (!isActive || !mediaStream || !mimeType) {
      return
    }

    // Per-mount session object so async callbacks from a previous mount
    // (StrictMode double-effects, stop/start races) become no-ops.
    const session = {
      active: true,
      degraded: false,
      failures: 0,
      recorders: new Set<MediaRecorder>(),
      timers: new Set<ReturnType<typeof setTimeout>>(),
    }

    const setTimer = (fn: () => void, ms: number) => {
      const id = setTimeout(() => {
        session.timers.delete(id)
        fn()
      }, ms)
      session.timers.add(id)
      return id
    }

    const stopAllRecorders = () => {
      for (const recorder of session.recorders) {
        try {
          recorder.stop()
        } catch {
          // Already inactive.
        }
      }
      session.recorders.clear()
    }

    const enterDegradedMode = () => {
      if (session.degraded || !session.active) {
        return
      }
      session.degraded = true
      setDegraded(true)
      stopAllRecorders()
      setTimer(() => recordSegment(true), PROBE_INTERVAL_MS)
    }

    const recoverFromProbe = () => {
      if (!session.degraded || !session.active) {
        return
      }
      session.degraded = false
      session.failures = 0
      setDegraded(false)
      recordSegment(false)
    }

    const handleSegment = async (blob: Blob, volumeSamples: number[], isProbe: boolean) => {
      if (!session.active) {
        return
      }

      const peak = volumeSamples.length > 0 ? Math.max(...volumeSamples) : 0
      const mean =
        volumeSamples.length > 0
          ? volumeSamples.reduce((sum, v) => sum + v, 0) / volumeSamples.length
          : 0

      // Probes skip the silence gate: recovery only needs the HTTP round trip
      // to succeed, and the probe's text is discarded either way.
      if (!isProbe) {
        if (blob.size === 0 || (mean < SILENCE_MEAN_THRESHOLD && peak < SILENCE_PEAK_THRESHOLD)) {
          return
        }
      }

      const uploadStartedAt = performance.now()
      try {
        const result = await transcribe(blob, blob.type, toLanguageHint(languageRef.current))
        if (!session.active) {
          return
        }
        setLastLatencyMs(Math.round(performance.now() - uploadStartedAt))
        session.failures = 0

        if (isProbe) {
          recoverFromProbe()
          return
        }

        const text = filterTranscript(result.transcript, peak)
        if (text) {
          onFinalEntriesRef.current([{ text, timestamp: Date.now(), source: 'groq' }])
        }
      } catch {
        if (!session.active) {
          return
        }
        if (isProbe) {
          setTimer(() => recordSegment(true), PROBE_INTERVAL_MS)
          return
        }
        session.failures += 1
        if (session.failures >= MAX_CONSECUTIVE_FAILURES) {
          enterDegradedMode()
        }
      }
    }

    const recordSegment = (isProbe: boolean) => {
      if (!session.active || !mediaStream.active) {
        return
      }

      let recorder: MediaRecorder
      try {
        recorder = new MediaRecorder(mediaStream, { mimeType })
      } catch {
        enterDegradedMode()
        return
      }
      session.recorders.add(recorder)

      const chunks: Blob[] = []
      const volumeSamples: number[] = []
      const volumeTimer = setInterval(() => {
        volumeSamples.push(volumeRef.current)
      }, VOLUME_SAMPLE_MS)

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data)
        }
      }
      recorder.onstop = () => {
        clearInterval(volumeTimer)
        session.recorders.delete(recorder)
        void handleSegment(new Blob(chunks, { type: mimeType }), volumeSamples, isProbe)
      }

      try {
        recorder.start()
      } catch {
        clearInterval(volumeTimer)
        session.recorders.delete(recorder)
        enterDegradedMode()
        return
      }

      setTimer(() => {
        // Zero-gap handoff: start the next segment before stopping this one.
        if (!isProbe && session.active && !session.degraded) {
          recordSegment(false)
        }
        try {
          recorder.stop()
        } catch {
          // Already inactive.
        }
      }, SEGMENT_MS)
    }

    // Fresh session: clear any degradation left over from the previous one
    // (async to satisfy react-hooks/set-state-in-effect).
    setTimer(() => setDegraded(false), 0)
    recordSegment(false)

    return () => {
      session.active = false
      for (const id of session.timers) {
        clearTimeout(id)
      }
      session.timers.clear()
      stopAllRecorders()
    }
  }, [isActive, mediaStream, mimeType])

  return { engine, lastLatencyMs }
}
