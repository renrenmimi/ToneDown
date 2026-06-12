import { useCallback, useEffect, useRef } from 'react'
import { useAudioAnalyser } from './useAudioAnalyser'
import { useGroqTranscriber } from './useGroqTranscriber'
import { useSpeechRecognition } from './useSpeechRecognition'
import { useToneAnalysis } from './useToneAnalysis'
import { useLocale } from '@/shared/i18n/localeContext'
import { systemClock } from '@/shared/ports/clock'
import type { TranscriptEntry } from '@/types/app'
import { useEngines, useIsSessionActive, useSessionPhase, useTranscript } from '../machine/selectors'
import { sessionStore, volumeSignal } from '../machine/sessionStore'
import { useFusionService } from './useFusionService'

/**
 * Render-nothing component that mounts the session services: the adapters
 * between browser APIs / LLM endpoints and the session machine. Services
 * read via selectors, do their side effects, and dispatch events; the
 * machine's effects-as-data (acquireMic/releaseMic) are executed here.
 */
export function SessionServices() {
  const { locale: language } = useLocale()
  const phase = useSessionPhase()
  const isActive = useIsSessionActive()
  const engines = useEngines()
  const transcript = useTranscript()

  const audio = useAudioAnalyser()
  const audioRef = useRef(audio)
  useEffect(() => {
    audioRef.current = audio
  })

  // --- machine effects: mic lifecycle ---
  useEffect(() => {
    return sessionStore.onEffect((effect) => {
      if (effect.kind === 'acquireMic') {
        const current = audioRef.current
        current.clearError()
        void current.startListening().then((ok) => {
          if (ok) {
            const at = systemClock.now()
            sessionStore.dispatch({ type: 'MIC_READY', at })
            // No calibration UX yet: pass straight through to listening.
            sessionStore.dispatch({ type: 'CALIBRATION_COMPLETE', at })
          }
          // Failures surface via audio.error and are dispatched below, once
          // the hook's state has settled (the boolean alone lacks the reason).
        })
      } else if (effect.kind === 'releaseMic') {
        audioRef.current.stopListening()
      }
    })
  }, [])

  useEffect(() => {
    if (phase === 'calibrating' && audio.error) {
      sessionStore.dispatch({
        type: 'MIC_DENIED',
        reason: audio.error === 'MIC_PERMISSION_DENIED' ? 'MIC_PERMISSION_DENIED' : 'MIC_INIT_FAILED',
      })
    }
  }, [audio.error, phase])

  // --- volume: 100ms RMS onto the signal bus (never through the machine) ---
  useEffect(() => {
    volumeSignal.set(audio.volume)
  }, [audio.volume])

  // --- STT engines feeding the shared transcript ---
  const dispatchFinalEntries = useCallback((entries: TranscriptEntry[]) => {
    sessionStore.dispatch({ type: 'TRANSCRIPT_FINALIZED', entries })
  }, [])
  const dispatchInterim = useCallback((text: string) => {
    sessionStore.dispatch({ type: 'INTERIM_CHANGED', text })
  }, [])

  const speech = useSpeechRecognition({
    language,
    onFinalEntries: dispatchFinalEntries,
    onInterim: dispatchInterim,
  })
  const transcriber = useGroqTranscriber({
    mediaStream: audio.mediaStream,
    volume: audio.volume,
    isActive,
    language,
    onFinalEntries: dispatchFinalEntries,
  })

  useEffect(() => {
    sessionStore.dispatch({ type: 'STT_ENGINE_CHANGED', engine: transcriber.engine })
  }, [transcriber.engine])

  // Web Speech runs only while the Groq path is degraded; recovery stops it.
  const speechStart = speech.start
  const speechStop = speech.stop
  useEffect(() => {
    if (!isActive || engines.stt !== 'browser' || !speech.isSupported) {
      return
    }
    speechStart()
    return () => {
      speechStop()
    }
  }, [engines.stt, isActive, speech.isSupported, speechStart, speechStop])

  // --- semantic analysis + fusion ---
  const toneAnalysis = useToneAnalysis({ entries: transcript, language, isActive })

  useEffect(() => {
    sessionStore.dispatch({
      type: 'ANALYSIS_MODE_CHANGED',
      mode: toneAnalysis.available ? 'llm' : 'rules',
    })
  }, [toneAnalysis.available])

  useFusionService({
    llmTone: toneAnalysis.latest,
    llmAvailable: toneAnalysis.available,
    language,
  })

  // --- 1s TICK heartbeat drives all machine timing while a session runs ---
  useEffect(() => {
    if (!isActive) {
      return
    }
    return systemClock.setInterval(() => {
      sessionStore.dispatch({ type: 'TICK', at: systemClock.now() })
    }, 1_000)
  }, [isActive])

  return null
}
