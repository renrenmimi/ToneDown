import { useEffect, useRef } from 'react'
import { sessionStore } from '@/features/live-session/machine/sessionStore'
import type { EmotionLevel } from '@/types/app'

type AuroraTone = 'calm' | 'tense' | 'heated' | 'hostile'

const LEVEL_TO_TONE: Record<EmotionLevel, AuroraTone> = {
  calm: 'calm',
  elevated: 'tense',
  heated: 'heated',
  critical: 'hostile',
}

/**
 * Ambient aurora background. All animation is CSS (transform-only keyframes,
 * @property color crossfades); this component's JS is limited to:
 * - one documentElement.dataset.tone write per *band change*, with 2-tick
 *   hysteresis so a single spiky score can't strobe the room
 * - pausing the drift while the tab is hidden
 */
export function Aurora() {
  const pendingToneRef = useRef<{ tone: AuroraTone; ticks: number } | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const root = document.documentElement
    root.dataset.tone = 'calm'

    let lastLevel: EmotionLevel = 'calm'
    const unsubscribe = sessionStore.subscribe(() => {
      const level = sessionStore.getState().emotionLevel
      if (level === lastLevel) {
        return
      }
      lastLevel = level
      const tone = LEVEL_TO_TONE[level]
      const current = (root.dataset.tone ?? 'calm') as AuroraTone
      if (tone === current) {
        pendingToneRef.current = null
        return
      }
      const pending = pendingToneRef.current
      // Hysteresis: a new band must survive two consecutive observations
      // (≈two 2s ticks) before the room changes color — except escalations
      // toward hostile, which show immediately (the warning must not lag).
      if (tone === 'hostile' || (pending && pending.tone === tone)) {
        root.dataset.tone = tone
        pendingToneRef.current = null
      } else {
        pendingToneRef.current = { tone, ticks: 1 }
      }
    })

    return () => {
      unsubscribe()
      delete root.dataset.tone
    }
  }, [])

  useEffect(() => {
    const onVisibility = () => {
      rootRef.current?.classList.toggle('aurora--paused', document.hidden)
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  return (
    <div ref={rootRef} className="aurora" aria-hidden>
      <i />
      <i />
      <i />
    </div>
  )
}
