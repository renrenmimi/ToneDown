import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const SAMPLE_INTERVAL_MS = 100
const VOLUME_SCALE = 260

type AudioContextCtor = typeof AudioContext

interface WebkitAudioWindow extends Window {
  webkitAudioContext?: AudioContextCtor
}

export function isAudioAnalyserSupported(): boolean {
  if (!navigator.mediaDevices?.getUserMedia) {
    return false
  }
  return Boolean(window.AudioContext || (window as WebkitAudioWindow).webkitAudioContext)
}

interface UseAudioAnalyserArgs {
  /**
   * Receives each 0-100 RMS sample at SAMPLE_INTERVAL_MS. Deliberately a
   * callback rather than returned state: at 10Hz React state here would
   * re-render every consumer of this hook ten times a second, which is
   * exactly what the signal bus exists to avoid.
   */
  onSample: (volume: number) => void
}

interface UseAudioAnalyserResult {
  isListening: boolean
  isSupported: boolean
  error: string | null
  /** The shared mic stream, so other consumers (MediaRecorder) avoid a second capture. */
  mediaStream: MediaStream | null
  startListening: () => Promise<boolean>
  stopListening: () => void
  clearError: () => void
}

export function useAudioAnalyser({ onSample }: UseAudioAnalyserArgs): UseAudioAnalyserResult {
  const [isListening, setIsListening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null)

  const onSampleRef = useRef(onSample)
  useEffect(() => {
    onSampleRef.current = onSample
  }, [onSample])

  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const intervalRef = useRef<number | null>(null)

  const isSupported = useMemo(() => isAudioAnalyserSupported(), [])

  const clearSamplingInterval = () => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  const cleanupAudioGraph = useCallback(() => {
    clearSamplingInterval()

    if (sourceRef.current) {
      sourceRef.current.disconnect()
      sourceRef.current = null
    }

    if (analyserRef.current) {
      analyserRef.current.disconnect()
      analyserRef.current = null
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    setMediaStream(null)

    if (audioContextRef.current) {
      void audioContextRef.current.close().catch(() => undefined)
      audioContextRef.current = null
    }
  }, [])

  const stopListening = useCallback(() => {
    cleanupAudioGraph()
    setIsListening(false)
    onSampleRef.current(0)
  }, [cleanupAudioGraph])

  const startListening = useCallback(async () => {
    if (!isSupported) {
      setError('AUDIO_UNSUPPORTED')
      return false
    }

    try {
      setError(null)
      stopListening()

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const AudioContextCtorRef =
        window.AudioContext || (window as WebkitAudioWindow).webkitAudioContext

      if (!AudioContextCtorRef) {
        setError('AUDIO_UNSUPPORTED')
        stream.getTracks().forEach((track) => track.stop())
        return false
      }

      const audioContext = new AudioContextCtorRef()
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 2048
      analyser.smoothingTimeConstant = 0.75

      const source = audioContext.createMediaStreamSource(stream)
      source.connect(analyser)

      audioContextRef.current = audioContext
      analyserRef.current = analyser
      sourceRef.current = source
      streamRef.current = stream
      setMediaStream(stream)

      const samples = new Uint8Array(analyser.fftSize)

      intervalRef.current = window.setInterval(() => {
        if (!analyserRef.current) {
          return
        }

        analyserRef.current.getByteTimeDomainData(samples)
        let sum = 0

        for (let i = 0; i < samples.length; i += 1) {
          const centered = (samples[i] - 128) / 128
          sum += centered * centered
        }

        const rms = Math.sqrt(sum / samples.length)
        const normalized = Math.max(0, Math.min(100, Math.round(rms * VOLUME_SCALE)))

        onSampleRef.current(normalized)
      }, SAMPLE_INTERVAL_MS)

      setIsListening(true)
      return true
    } catch (caughtError) {
      const domError = caughtError as DOMException

      if (domError?.name === 'NotAllowedError') {
        setError('MIC_PERMISSION_DENIED')
      } else {
        setError('MIC_INIT_FAILED')
      }

      stopListening()
      return false
    }
  }, [isSupported, stopListening])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  useEffect(() => {
    return () => {
      cleanupAudioGraph()
    }
  }, [cleanupAudioGraph])

  return {
    isListening,
    isSupported,
    error,
    mediaStream,
    startListening,
    stopListening,
    clearError,
  }
}
