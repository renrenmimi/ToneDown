import { describe, expect, it } from 'vitest'
import { fuseScore } from '@/features/live-session/lib/fusion'
import type { SignalBreakdown } from '@/types/app'
import type { Locale } from '@/shared/i18n/localeContext'
import type { DemoSink } from './script'
import { buildDemoSteps } from './script'

function replay(locale: Locale) {
  const visible: string[] = []
  const rationales: string[] = []
  const scored: { score: number; signals: SignalBreakdown | undefined }[] = []
  let recordLanguage: string | null = null

  const sink: DemoSink = {
    dispatch: (event) => {
      if (event.type === 'TRANSCRIPT_FINALIZED') {
        visible.push(...event.entries.map((entry) => entry.text))
      }
      if (event.type === 'SCORE_UPDATED') {
        scored.push({ score: event.score, signals: event.signals })
      }
    },
    setVolume: () => undefined,
    setFrame: (frame) => {
      if (frame.llmTone?.rationale) {
        visible.push(frame.llmTone.rationale)
        rationales.push(frame.llmTone.rationale)
      }
    },
    setSuggestion: (suggestion) => {
      if (suggestion) visible.push(suggestion.original, suggestion.rewrite)
    },
    setRecap: (record, debrief) => {
      recordLanguage = record.language
      visible.push(
        debrief.summary,
        debrief.emotional_arc,
        debrief.one_habit_to_practice,
        ...debrief.trigger_moments.flatMap((moment) => [
          moment.quote,
          moment.why_it_escalated,
          moment.better_phrasing,
        ]),
      )
    },
  }

  buildDemoSteps(locale).forEach((step) => step.run(sink, step.at))
  return { visible: visible.join('\n'), rationales, scored, recordLanguage }
}

describe('localized demo script', () => {
  it('keeps the English replay and recap entirely in English', () => {
    const replayed = replay('en-US')

    expect(replayed.recordLanguage).toBe('en-US')
    expect(replayed.visible).not.toMatch(/[一-鿿]/)
    expect(replayed.visible).toContain("You're late again!")
  })

  it('uses the Chinese scenario and persists its locale', () => {
    const replayed = replay('zh-CN')

    expect(replayed.recordLanguage).toBe('zh-CN')
    expect(replayed.visible).toContain('你怎么又迟到了')
    expect(replayed.visible).toContain('平静开场')
  })

  it('localizes every tone rationale, including the opening beat', () => {
    const zh = replay('zh-CN')
    const en = replay('en-US')

    expect(zh.rationales.length).toBeGreaterThan(0)
    expect(zh.rationales.every((line) => /[一-鿿]/.test(line))).toBe(true)
    expect(en.rationales.every((line) => !/[一-鿿]/.test(line))).toBe(true)
  })
})

describe('scripted scores are the real fusion math', () => {
  it('every dispatched score is what fuseScore makes of its own signals', () => {
    const { scored } = replay('en-US')

    expect(scored.length).toBeGreaterThan(0)
    for (const tick of scored) {
      expect(tick.signals).toBeDefined()
      expect(fuseScore(tick.signals!).score).toBe(tick.score)
    }
  })

  it('still tells the arc: calm, a hostile peak past the trigger, then recovery', () => {
    const scores = replay('en-US').scored.map((tick) => tick.score)
    const peak = Math.max(...scores)

    expect(scores[0]).toBeLessThan(30)
    expect(peak).toBeGreaterThanOrEqual(70)
    expect(scores[scores.length - 1]).toBeLessThan(30)
  })

  it('drives both locales through the identical arc', () => {
    expect(replay('zh-CN').scored.map((tick) => tick.score)).toEqual(
      replay('en-US').scored.map((tick) => tick.score),
    )
  })
})
