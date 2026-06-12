import { describe, expect, it } from 'vitest'
import type { LlmToneResult, TranscriptEntry } from '@/types/app'
import {
  computeScore,
  detectKeywords,
  getEmotionLevel,
  getSpeedBonus,
  getVolumeBonus,
  KEYWORD_WINDOW_MS,
  LLM_FRESH_MS,
  SEMANTIC_FLOOR_SCORE,
} from './fusion'

const NOW = 1_750_000_000_000

const entry = (text: string, ageMs = 0): TranscriptEntry => ({
  text,
  timestamp: NOW - ageMs,
})

const llm = (
  tone: LlmToneResult['tone'],
  intensity: number,
  ageMs = 0,
): LlmToneResult => ({ tone, intensity, rationale: '', at: NOW - ageMs })

describe('rules mode (degraded) — bit-compatible with the Phase-1 formula', () => {
  it('reproduces base + volume + speed + 15/8 keyword weights', () => {
    // vol 75 (+30), very_fast (+25), 1 high (+15), 1 medium (+8) => 30+78 = 108 -> clamp 100
    const result = computeScore(
      75,
      'very_fast',
      [entry('你总是这样 为什么不听')],
      NOW,
      null,
      false,
    )
    expect(result.score).toBe(100)
    expect(result.fusionMode).toBe('rules')
    expect(result.emotionLevel).toBe('critical')
  })

  it('quiet calm speech scores the base 30', () => {
    const result = computeScore(10, 'normal', [entry('今天天气不错')], NOW, null, false)
    expect(result.score).toBe(30)
    expect(result.emotionLevel).toBe('calm')
  })

  it('llmAvailable=false forces rules mode even with a fresh LLM result', () => {
    const result = computeScore(10, 'normal', [], NOW, llm('aggressive', 90), false)
    expect(result.fusionMode).toBe('rules')
    expect(result.score).toBe(30)
  })

  it('volume and speed bonus bands match legacy thresholds', () => {
    expect(getVolumeBonus(30)).toBe(0)
    expect(getVolumeBonus(31)).toBe(10)
    expect(getVolumeBonus(51)).toBe(20)
    expect(getVolumeBonus(71)).toBe(30)
    expect(getSpeedBonus('slow')).toBe(0)
    expect(getSpeedBonus('normal')).toBe(0)
    expect(getSpeedBonus('fast')).toBe(15)
    expect(getSpeedBonus('very_fast')).toBe(25)
  })
})

describe('LLM fusion', () => {
  it('fresh aggressive LLM result dominates at 60% weight', () => {
    // rules part: 30 + 30(vol) + 15(fast) + 8(1 high, llm-mode weight) = 83
    // semantic: 90 * 1.0 = 90 ; weight 0.6 fresh
    // 0.4*83 + 0.6*90 = 87.2 -> 87
    const result = computeScore(75, 'fast', [entry('你总是这样')], NOW, llm('aggressive', 90), true)
    expect(result.fusionMode).toBe('llm')
    expect(result.score).toBe(87)
  })

  it('fresh positive LLM suppresses loud-but-friendly false positives', () => {
    // rules: 30+30 = 60 ; semantic: 20 * 0 = 0 ; 0.4*60 = 24
    const result = computeScore(75, 'normal', [], NOW, llm('positive', 20), true)
    expect(result.score).toBe(24)
    expect(result.emotionLevel).toBe('calm')
  })

  it('weight decays linearly with staleness and hits rules mode at 20s', () => {
    const fresh = computeScore(75, 'normal', [], NOW, llm('positive', 20), true)
    const half = computeScore(75, 'normal', [], NOW, llm('positive', 20, LLM_FRESH_MS / 2), true)
    const stale = computeScore(75, 'normal', [], NOW, llm('positive', 20, LLM_FRESH_MS), true)
    // weight 0.3 at half-life: 0.7*60 + 0.3*0 = 42
    expect(half.score).toBe(42)
    expect(half.fusionMode).toBe('llm')
    expect(fresh.score).toBeLessThan(half.score)
    // fully stale: exact legacy formula
    expect(stale.score).toBe(60)
    expect(stale.fusionMode).toBe('rules')
  })

  it('semantic floor lifts quiet menace to the intervention threshold', () => {
    // quiet (vol 5, slow): rules part = 30; semantic 75*1 = 75
    // blended: 0.4*30 + 0.6*75 = 57 -> floored to 72
    const result = computeScore(5, 'slow', [], NOW, llm('aggressive', 75), true)
    expect(result.score).toBe(SEMANTIC_FLOOR_SCORE)
  })

  it('semantic floor expires after 10s even while result is still fresh-ish', () => {
    const result = computeScore(5, 'slow', [], NOW, llm('aggressive', 75, 12_000), true)
    expect(result.score).toBeLessThan(SEMANTIC_FLOOR_SCORE)
  })

  it('tone multipliers order the same intensity correctly', () => {
    const at = (tone: LlmToneResult['tone']) =>
      computeScore(5, 'slow', [], NOW, llm(tone, 60), true).score
    expect(at('aggressive')).toBeGreaterThan(at('passive-aggressive'))
    expect(at('passive-aggressive')).toBeGreaterThan(at('defensive'))
    expect(at('defensive')).toBeGreaterThan(at('neutral'))
    expect(at('neutral')).toBeGreaterThan(at('positive'))
  })
})

describe('keyword detection', () => {
  it('matches zh substrings case-sensitively and en lowercased', () => {
    const result = detectKeywords([entry('你总是这样'), entry('You NEVER listen')], NOW)
    expect(result.highRiskKeywords).toContain('你总是')
    expect(result.highRiskKeywords).toContain('you never')
  })

  it('ignores entries older than the 30s window', () => {
    const result = detectKeywords([entry('你总是这样', KEYWORD_WINDOW_MS + 1)], NOW)
    expect(result.highRiskKeywords).toHaveLength(0)
  })

  it('deduplicates repeated keywords', () => {
    const result = detectKeywords([entry('烦死了 烦死了'), entry('烦死了')], NOW)
    expect(result.highRiskKeywords).toEqual(['烦死了'])
  })
})

describe('emotion levels', () => {
  it('maps score bands to levels at the documented boundaries', () => {
    expect(getEmotionLevel(30)).toBe('calm')
    expect(getEmotionLevel(31)).toBe('elevated')
    expect(getEmotionLevel(55)).toBe('elevated')
    expect(getEmotionLevel(56)).toBe('heated')
    expect(getEmotionLevel(75)).toBe('heated')
    expect(getEmotionLevel(76)).toBe('critical')
  })
})
