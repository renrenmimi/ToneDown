import { useCallback, useEffect, useRef, useState } from 'react'
import { useLiveSessionT } from '@/features/live-session/i18n'

interface CalmReminderProps {
  score: number
  isActive: boolean
}

const TRIGGER_SCORE = 70
const TRIGGER_DURATION_MS = 5_000
const REMINDER_DURATION_SECONDS = 30
const COOLDOWN_MS = 60_000

export function CalmReminder({ score, isActive }: CalmReminderProps) {
  const copy = useLiveSessionT().calmReminder
  const [isVisible, setIsVisible] = useState(false)
  const [countdown, setCountdown] = useState(REMINDER_DURATION_SECONDS)

  const highRiskTimerRef = useRef<number | null>(null)
  const countdownTimerRef = useRef<number | null>(null)
  const cooldownUntilRef = useRef(0)

  const clearHighRiskTimer = useCallback(() => {
    if (highRiskTimerRef.current !== null) {
      window.clearTimeout(highRiskTimerRef.current)
      highRiskTimerRef.current = null
    }
  }, [])

  const clearCountdownTimer = useCallback(() => {
    if (countdownTimerRef.current !== null) {
      window.clearInterval(countdownTimerRef.current)
      countdownTimerRef.current = null
    }
  }, [])

  const closeReminder = useCallback(() => {
    clearHighRiskTimer()
    clearCountdownTimer()
    setIsVisible(false)
    setCountdown(REMINDER_DURATION_SECONDS)
    cooldownUntilRef.current = Date.now() + COOLDOWN_MS
  }, [clearCountdownTimer, clearHighRiskTimer])

  const openReminder = useCallback(() => {
    clearHighRiskTimer()
    clearCountdownTimer()

    setCountdown(REMINDER_DURATION_SECONDS)
    setIsVisible(true)

    countdownTimerRef.current = window.setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearCountdownTimer()
          setIsVisible(false)
          cooldownUntilRef.current = Date.now() + COOLDOWN_MS
          return REMINDER_DURATION_SECONDS
        }

        return prev - 1
      })
    }, 1_000)
  }, [clearCountdownTimer, clearHighRiskTimer])

  useEffect(() => {
    if (!isActive) {
      clearHighRiskTimer()
      clearCountdownTimer()

      if (isVisible) {
        const resetTimerId = window.setTimeout(() => {
          setIsVisible(false)
          setCountdown(REMINDER_DURATION_SECONDS)
        }, 0)

        return () => {
          window.clearTimeout(resetTimerId)
        }
      }

      return
    }

    if (isVisible) {
      return
    }

    if (Date.now() < cooldownUntilRef.current) {
      clearHighRiskTimer()
      return
    }

    if (score >= TRIGGER_SCORE) {
      if (highRiskTimerRef.current === null) {
        highRiskTimerRef.current = window.setTimeout(() => {
          highRiskTimerRef.current = null
          openReminder()
        }, TRIGGER_DURATION_MS)
      }
      return
    }

    clearHighRiskTimer()
  }, [
    clearCountdownTimer,
    clearHighRiskTimer,
    isActive,
    isVisible,
    openReminder,
    score,
  ])

  useEffect(() => {
    return () => {
      clearHighRiskTimer()
      clearCountdownTimer()
    }
  }, [clearCountdownTimer, clearHighRiskTimer])

  if (!isVisible || !isActive) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-6 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-3xl border border-slate-700 bg-slate-900/95 p-6 text-center shadow-2xl">
        <h3 className="text-3xl font-bold text-emerald-300">{copy.title}</h3>
        <p className="mt-3 text-sm text-slate-200">{copy.description}</p>

        <div className="my-6 flex justify-center">
          <div
            className="h-28 w-28 rounded-full bg-emerald-400/30 shadow-[0_0_50px_rgba(16,185,129,0.35)] animate-pulse"
            style={{ animationDuration: '4s' }}
          />
        </div>

        <p className="text-base text-slate-300">
          {copy.countdown}: <span className="font-semibold text-emerald-300">{countdown}s</span>
        </p>

        <button
          type="button"
          className="mt-5 w-full rounded-full bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
          onClick={closeReminder}
        >
          {copy.button}
        </button>
      </div>
    </div>
  )
}
