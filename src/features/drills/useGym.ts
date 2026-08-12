import { useCallback, useEffect, useRef, useState } from 'react'
import { gymGradeEndpoint } from '@/shared/llm/endpoints'
import type { DrillProgressRecord } from '@/shared/storage/records'
import type { GymGradeResponse } from '@/types/api'
import type { Locale } from '@/shared/i18n/localeContext'
import type { AchievementId } from './i18n'
import { gradeCacheKey, localDateKey, todaysDrill, type Drill } from './drills'

export type GradeStatus = 'idle' | 'grading' | 'done' | 'failed'

export interface GymState {
  drill: Drill
  records: DrillProgressRecord[]
  status: GradeStatus
  lastGrade: GymGradeResponse | null
  clearedToday: boolean
  streak: number
  achievements: AchievementId[]
}

function computeStreak(records: DrillProgressRecord[], now = Date.now()): number {
  const clearedDates = new Set(records.filter((r) => r.cleared).map((r) => r.date))
  let streak = 0
  // Count back from today; an uncleared today doesn't break yesterday's streak.
  for (let day = 0; ; day += 1) {
    const key = localDateKey(now - day * 86_400_000)
    if (clearedDates.has(key)) {
      streak += 1
    } else if (day === 0) {
      continue
    } else {
      break
    }
  }
  return streak
}

function computeAchievements(records: DrillProgressRecord[], streak: number): AchievementId[] {
  const cleared = records.filter((r) => r.cleared)
  const out: AchievementId[] = []
  if (cleared.length > 0) out.push('day-one')
  if (streak >= 7) out.push('steady-week')
  if (
    cleared.some((r) => r.drillId.startsWith('zh-')) &&
    cleared.some((r) => r.drillId.startsWith('en-'))
  ) {
    out.push('switch-hitter')
  }
  if (records.some((r) => r.bestScore >= 95)) out.push('word-surgeon')
  if (cleared.some((r) => r.attempts >= 3)) out.push('phoenix')
  return out
}

export function useGym(locale: Locale) {
  const drill = todaysDrill(locale)
  const [records, setRecords] = useState<DrillProgressRecord[]>([])
  const [status, setStatus] = useState<GradeStatus>('idle')
  const [lastGrade, setLastGrade] = useState<GymGradeResponse | null>(null)
  const gradingRef = useRef(false)

  useEffect(() => {
    void import('@/shared/storage/db')
      .then(({ getDb }) => getDb().drills.toArray())
      .then(setRecords)
      .catch(() => setRecords([]))
  }, [])

  const grade = useCallback(
    async (attempt: string) => {
      const text = attempt.trim()
      // Ref, not `status`: the state guard only takes effect after commit, so
      // two submits in one tick would both pass it and grade twice.
      if (text.length < 2 || gradingRef.current || status === 'grading') {
        return
      }
      gradingRef.current = true
      setStatus('grading')

      const cacheKey = gradeCacheKey(drill.id, text)
      let result: GymGradeResponse | null = null

      // Cache first: identical answers never spend tokens twice.
      try {
        const { getDb } = await import('@/shared/storage/db')
        const cached = await getDb().gradeCache.get(cacheKey)
        if (cached) {
          result = {
            score: cached.score,
            passed: cached.score >= 90,
            feedback: cached.feedback,
            better_version: cached.betterVersion,
          }
        }
      } catch {
        // cache unavailable: fall through to the network
      }

      if (!result) {
        try {
          result = await gymGradeEndpoint.call({
            language: locale,
            drillId: drill.id,
            phrase: drill.phrase,
            attempt: text,
          })
          void import('@/shared/storage/db')
            .then(({ getDb }) =>
              getDb().gradeCache.put({
                key: cacheKey,
                score: result!.score,
                feedback: result!.feedback,
                betterVersion: result!.better_version,
                createdAt: Date.now(),
              }),
            )
            .catch(() => undefined)
        } catch {
          gradingRef.current = false
          setStatus('failed')
          return
        }
      }

      gradingRef.current = false
      setLastGrade(result)
      setStatus('done')

      // Upsert today's progress for this drill.
      try {
        const { getDb } = await import('@/shared/storage/db')
        const db = getDb()
        const date = localDateKey()
        const existing = await db.drills.where({ date, drillId: drill.id }).first()
        if (existing?.id !== undefined) {
          await db.drills.update(existing.id, {
            bestScore: Math.max(existing.bestScore, result.score),
            cleared: existing.cleared || result.passed,
            attempts: existing.attempts + 1,
          })
        } else {
          await db.drills.add({
            date,
            drillId: drill.id,
            bestScore: result.score,
            cleared: result.passed,
            attempts: 1,
          })
        }
        setRecords(await db.drills.toArray())
      } catch {
        // progress not persisted (private browsing); the grade still shows
      }
    },
    [drill, locale, status],
  )

  const streak = computeStreak(records)
  const state: GymState = {
    drill,
    records,
    status,
    lastGrade,
    clearedToday: records.some((r) => r.date === localDateKey() && r.drillId === drill.id && r.cleared),
    streak,
    achievements: computeAchievements(records, streak),
  }

  return { state, grade }
}
