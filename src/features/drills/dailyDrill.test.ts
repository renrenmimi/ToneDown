// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { localDateKey, todaysDrill } from './drills'

const useTimeZone = (tz: string) => vi.stubEnv('TZ', tz)

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('todaysDrill', () => {
  it('is stable across a whole local calendar day', () => {
    useTimeZone('America/Los_Angeles')
    const day = '2026-06-12'
    const atHour = (h: number) =>
      todaysDrill('en-US', new Date(`${day}T${String(h).padStart(2, '0')}:30:00`).getTime()).id

    const morning = atHour(8)
    for (let h = 0; h < 24; h += 1) {
      expect(atHour(h), `hour ${h} drifted`).toBe(morning)
    }
  })

  // Regression: the index was floor(now / 86_400_000), i.e. UTC days, while
  // clearedToday/computeStreak key off localDateKey. In UTC-7 the drill swapped
  // at 5pm local — same calendar day, different drill, cleared badge reset.
  it.each(['America/Los_Angeles', 'America/New_York', 'Asia/Shanghai'])(
    'rotates on the same boundary as localDateKey in %s',
    (tz) => {
      useTimeZone(tz)
      const beforeMidnight = new Date('2026-06-12T23:59:00').getTime()
      const afterMidnight = new Date('2026-06-13T00:01:00').getTime()

      // Different local dates -> different drill.
      expect(localDateKey(beforeMidnight)).not.toBe(localDateKey(afterMidnight))
      expect(todaysDrill('en-US', beforeMidnight).id).not.toBe(
        todaysDrill('en-US', afterMidnight).id,
      )

      // Same local date -> same drill, whichever side of UTC midnight it is.
      const sameDayLate = new Date('2026-06-12T18:00:00').getTime()
      expect(localDateKey(sameDayLate)).toBe(localDateKey(beforeMidnight))
      expect(todaysDrill('en-US', sameDayLate).id).toBe(todaysDrill('en-US', beforeMidnight).id)
    },
  )

  it('returns a drill in the requested locale', () => {
    useTimeZone('UTC')
    const now = new Date('2026-06-12T09:00:00').getTime()
    expect(todaysDrill('zh-CN', now).locale).toBe('zh-CN')
    expect(todaysDrill('en-US', now).locale).toBe('en-US')
  })
})
