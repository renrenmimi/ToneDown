import { describe, expect, it } from 'vitest'
import type { TranscriptEntry } from '@/types/app'
import {
  computeWordsPerMinute,
  countChineseCharacters,
  countEnglishWords,
  getSpeedLevel,
  SPEECH_RATE_WINDOW_MS,
} from './speechRate'

const NOW = 1_750_000_000_000
const entry = (text: string, ageMs = 0): TranscriptEntry => ({ text, timestamp: NOW - ageMs })

describe('counting', () => {
  it('counts Han characters for Chinese', () => {
    expect(countChineseCharacters('你怎么又迟到了')).toBe(7)
  })

  it('falls back to non-space length when no Han characters', () => {
    expect(countChineseCharacters('ok ok')).toBe(4)
  })

  it('counts words for English including contractions', () => {
    expect(countEnglishWords("you never listen, I'm done")).toBe(5)
  })
})

describe('computeWordsPerMinute', () => {
  it('extrapolates the 10s window to a per-minute rate', () => {
    // 30 chars within the window -> 30 / 10s * 60s = 180
    const transcript = [entry('一'.repeat(30))]
    expect(computeWordsPerMinute(transcript, 'zh-CN', NOW)).toBe(180)
  })

  it('excludes entries outside the window', () => {
    const transcript = [entry('一'.repeat(30), SPEECH_RATE_WINDOW_MS + 1)]
    expect(computeWordsPerMinute(transcript, 'zh-CN', NOW)).toBe(0)
  })
})

describe('getSpeedLevel thresholds', () => {
  it('zh thresholds', () => {
    expect(getSpeedLevel(149, 'zh-CN')).toBe('slow')
    expect(getSpeedLevel(250, 'zh-CN')).toBe('normal')
    expect(getSpeedLevel(320, 'zh-CN')).toBe('fast')
    expect(getSpeedLevel(321, 'zh-CN')).toBe('very_fast')
  })

  it('en thresholds', () => {
    expect(getSpeedLevel(119, 'en-US')).toBe('slow')
    expect(getSpeedLevel(180, 'en-US')).toBe('normal')
    expect(getSpeedLevel(230, 'en-US')).toBe('fast')
    expect(getSpeedLevel(231, 'en-US')).toBe('very_fast')
  })
})
