import { useEffect, useRef, useState } from 'react'
import { ToneGauge } from '@/features/live-session/components/ToneGauge'
import { volumeSignal } from '@/features/live-session/machine/sessionStore'
import type { EmotionLevel } from '@/types/app'
import { useLandingT } from './i18n'

// The hero visual is the REAL ToneGauge replaying a canned 36s session —
// not a video, so it can never drift from the shipped product. Pauses when
// off-viewport; static under prefers-reduced-motion.

interface Keyframe {
  score: number
  level: EmotionLevel
  rate: number
  semantic: number
  volume: number
}

const SCRIPT: Keyframe[] = [
  { score: 24, level: 'calm', rate: 28, semantic: 12, volume: 18 },
  { score: 27, level: 'calm', rate: 32, semantic: 15, volume: 22 },
  { score: 30, level: 'calm', rate: 35, semantic: 18, volume: 26 },
  { score: 41, level: 'elevated', rate: 48, semantic: 35, volume: 38 },
  { score: 55, level: 'elevated', rate: 62, semantic: 52, volume: 55 },
  { score: 71, level: 'heated', rate: 74, semantic: 70, volume: 72 },
  { score: 83, level: 'critical', rate: 82, semantic: 88, volume: 80 },
  { score: 76, level: 'critical', rate: 70, semantic: 78, volume: 66 },
  { score: 58, level: 'heated', rate: 55, semantic: 55, volume: 48 },
  { score: 41, level: 'elevated', rate: 42, semantic: 34, volume: 34 },
  { score: 30, level: 'calm', rate: 33, semantic: 18, volume: 24 },
  { score: 25, level: 'calm', rate: 28, semantic: 12, volume: 18 },
]

const STEP_MS = 3_000
const REDUCED_FRAME = SCRIPT[2]

export function ScriptedHeroGauge() {
  const copy = useLandingT()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [frameIndex, setFrameIndex] = useState(0)
  const [running, setRunning] = useState(false)
  const reducedMotion =
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

  useEffect(() => {
    if (reducedMotion || !containerRef.current) {
      return
    }
    const observer = new IntersectionObserver(
      ([entry]) => setRunning(entry.isIntersecting),
      { threshold: 0.3 },
    )
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [reducedMotion])

  useEffect(() => {
    if (!running) {
      return
    }
    // Both timers share this local cursor — no ref gymnastics needed.
    let cursor = 0
    const frameTimer = window.setInterval(() => {
      cursor = (cursor + 1) % SCRIPT.length
      setFrameIndex(cursor)
    }, STEP_MS)
    // Outer ring wobble at 10Hz, like a real voice would.
    let t = 0
    const volumeTimer = window.setInterval(() => {
      t += 1
      const base = SCRIPT[cursor].volume
      volumeSignal.set(Math.max(0, base + Math.sin(t / 2.1) * 9 + Math.sin(t / 0.7) * 5))
    }, 100)
    return () => {
      window.clearInterval(frameTimer)
      window.clearInterval(volumeTimer)
      volumeSignal.set(0)
    }
  }, [running])

  const frame = reducedMotion ? REDUCED_FRAME : SCRIPT[frameIndex]

  return (
    <div ref={containerRef} className="flex flex-col items-center">
      <ToneGauge
        score={frame.score}
        level={frame.level}
        rateValue={frame.rate}
        semanticValue={frame.semantic}
        trendIcon={frame.score >= 55 ? '↑' : '→'}
        trendLabel=""
      />
      <p className="mt-1 text-xs text-ink-muted">{copy.gaugeCaption}</p>
    </div>
  )
}
