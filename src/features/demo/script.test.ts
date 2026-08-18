import { describe, expect, it } from 'vitest'
import type { Locale } from '@/shared/i18n/localeContext'
import type { DemoSink } from './script'
import { buildDemoSteps } from './script'

function replay(locale: Locale) {
  const visible: string[] = []
  let recordLanguage: string | null = null

  const sink: DemoSink = {
    dispatch: (event) => {
      if (event.type === 'TRANSCRIPT_FINALIZED') {
        visible.push(...event.entries.map((entry) => entry.text))
      }
    },
    setVolume: () => undefined,
    setFrame: (frame) => {
      if (frame.llmTone?.rationale) visible.push(frame.llmTone.rationale)
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
  return { visible: visible.join('\n'), recordLanguage }
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
})
