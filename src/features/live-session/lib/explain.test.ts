import { describe, expect, it } from 'vitest'
import type { SignalBreakdown, SpeedLevel } from '@/types/app'
import type { ToneLabel } from '@/types/api'
import {
  contributionsOf,
  dominantDriver,
  DOMINANCE_RATIO,
  evidenceShares,
  formatPoints,
  pointsFor,
  trackValues,
} from './explain'
import { BASE_SCORE, computeScore, LLM_MAX_WEIGHT, MAX_ACOUSTIC_BONUS } from './fusion'

const NOW = 1_750_000_000_000

const entry = (text: string) => ({ text, timestamp: NOW })

const signalsFor = (
  volume: number,
  speed: SpeedLevel,
  texts: string[],
  tone: ToneLabel | null,
  intensity = 0,
): SignalBreakdown =>
  computeScore(
    volume,
    speed,
    texts.map(entry),
    NOW,
    tone ? { tone, intensity, rationale: '', at: NOW } : null,
    tone !== null,
  ).signals

describe('contribution attribution', () => {
  it('the three terms reconcile with the fused score above the baseline', () => {
    // Nothing clamps here: 30 + 10 + 15 + keywords stays under 100.
    const result = computeScore(
      45,
      'fast',
      [entry('你总是这样')],
      NOW,
      { tone: 'defensive', intensity: 60, rationale: '', at: NOW },
      true,
    )
    const parts = contributionsOf(result.signals)
    const sum = parts.acoustic + parts.keyword + parts.semantic

    expect(Math.round(BASE_SCORE + sum)).toBe(result.score)
  })

  it('holds in rules mode, where the model contributes nothing', () => {
    const result = computeScore(75, 'very_fast', [entry('烦死了')], NOW, null, false)
    const parts = contributionsOf(result.signals)

    expect(parts.semantic).toBe(0)
    expect(BASE_SCORE + parts.acoustic + parts.keyword).toBe(result.score)
  })

  it('shrinks the rules side when loudness plus lexicon overflow the scale', () => {
    // 30 base + 55 acoustic + 24 lexicon = 109, clamped to 100 before blending.
    const result = computeScore(
      75,
      'very_fast',
      [entry('你总是这样'), entry('烦死了'), entry('你怎么又')],
      NOW,
      { tone: 'aggressive', intensity: 90, rationale: '', at: NOW },
      true,
    )
    const parts = contributionsOf(result.signals)

    expect(result.signals.semantic.keywordBonus).toBe(24)
    expect(Math.round(BASE_SCORE + parts.acoustic + parts.keyword + parts.semantic)).toBe(
      result.score,
    )
  })

  it('a calm model read contributes negatively — it pulls the score down', () => {
    const parts = contributionsOf(signalsFor(75, 'normal', [], 'positive', 20))

    expect(parts.semantic).toBeLessThan(0)
    expect(parts.semantic).toBeCloseTo(LLM_MAX_WEIGHT * -BASE_SCORE, 5)
  })
})

describe('dominant driver', () => {
  it('names the acoustic side when only loudness and pace are elevated', () => {
    expect(dominantDriver(signalsFor(80, 'very_fast', [], 'neutral', 50))).toBe('acoustic')
  })

  it('names the model read when a quiet voice says hostile things', () => {
    expect(dominantDriver(signalsFor(5, 'slow', [], 'aggressive', 80))).toBe('semantic')
  })

  it('names the lexicon when hostile phrasing lands without a model read', () => {
    expect(dominantDriver(signalsFor(10, 'slow', ['你总是这样'], null))).toBe('keyword')
  })

  it('reports both when neither side clearly leads', () => {
    // Acoustic 0.4*35 = 14 against text 0.6*(85*0.65 - 30) + 0.4*4 = 16.8 —
    // inside the 1.25 dominance ratio either way, so neither gets the credit.
    const signals = signalsFor(55, 'fast', ['为什么'], 'defensive', 85)
    const parts = contributionsOf(signals)

    expect(parts.acoustic / (parts.keyword + parts.semantic)).toBeLessThan(DOMINANCE_RATIO)
    expect((parts.keyword + parts.semantic) / parts.acoustic).toBeLessThan(DOMINANCE_RATIO)
    expect(dominantDriver(signals)).toBe('combined')
  })

  it('a floored tick is always attributed to the model read', () => {
    const signals = signalsFor(5, 'slow', [], 'aggressive', 75)
    expect(signals.semantic.floorApplied).toBe(true)
    expect(dominantDriver(signals)).toBe('semantic')
  })
})

describe('evidence shares', () => {
  it('normalizes the positive contributions to 1', () => {
    const shares = evidenceShares(signalsFor(80, 'fast', ['你总是这样'], 'aggressive', 90))
    const total = shares.acoustic + shares.keyword + shares.semantic

    expect(total).toBeCloseTo(1, 5)
  })

  it('returns all zeros when nothing pushed the score up', () => {
    expect(evidenceShares(signalsFor(10, 'slow', [], 'positive', 10))).toEqual({
      acoustic: 0,
      keyword: 0,
      semantic: 0,
    })
  })
})

describe('track values', () => {
  it('scales the acoustic track against the loudest, fastest possible tick', () => {
    expect(trackValues(signalsFor(80, 'very_fast', [], 'neutral', 10)).acoustic).toBe(100)
    expect(trackValues(signalsFor(10, 'slow', [], 'neutral', 10)).acoustic).toBe(0)
    // 30 + 15 out of 55.
    expect(trackValues(signalsFor(80, 'fast', [], 'neutral', 10)).acoustic).toBe(
      Math.round((45 / MAX_ACOUSTIC_BONUS) * 100),
    )
  })

  it('reads the semantic track from the model when one is live', () => {
    const values = trackValues(signalsFor(10, 'slow', [], 'passive-aggressive', 80))

    expect(values.semanticSource).toBe('llm')
    expect(values.tone).toBe('passive-aggressive')
    expect(values.semantic).toBe(68) // 80 * 0.85
  })

  it('falls back to lexicon strength when the model is unavailable', () => {
    const values = trackValues(signalsFor(10, 'slow', ['你总是这样'], null))

    expect(values.semanticSource).toBe('lexicon')
    expect(values.tone).toBeNull()
    expect(values.hasKeyword).toBe(true)
    expect(values.semantic).toBe(33) // one 15-point hit out of the 45-point full scale
  })
})

describe('printed points', () => {
  const cases: [string, number, SpeedLevel, string[], ToneLabel | null, number][] = [
    ['a plain blended tick', 45, 'fast', ['你总是这样'], 'defensive', 60],
    ['a clamped rules side', 75, 'very_fast', ['你总是这样', '烦死了', '你怎么又'], 'aggressive', 90],
    ['rules mode', 75, 'very_fast', ['烦死了'], null, 0],
    ['a calming model read', 80, 'fast', [], 'positive', 20],
  ]

  it.each(cases)('adds up to the score it explains: %s', (_name, volume, speed, texts, tone, intensity) => {
    const result = computeScore(
      volume,
      speed,
      texts.map(entry),
      NOW,
      tone ? { tone, intensity, rationale: '', at: NOW } : null,
      tone !== null,
    )
    const points = pointsFor(result.signals, result.score)

    expect(BASE_SCORE + points.acoustic + points.keyword + points.semantic).toBe(result.score)
  })

  it('leaves a floored tick unreconciled — the floor overrode the blend', () => {
    const result = computeScore(5, 'slow', [], NOW, {
      tone: 'aggressive',
      intensity: 75,
      rationale: '',
      at: NOW,
    }, true)
    const points = pointsFor(result.signals, result.score)

    expect(result.signals.semantic.floorApplied).toBe(true)
    expect(BASE_SCORE + points.acoustic + points.keyword + points.semantic).not.toBe(result.score)
  })
})

describe('point formatting', () => {
  it('signs positive values and leaves negatives alone', () => {
    expect(formatPoints(21.6)).toBe('+22')
    expect(formatPoints(-7.2)).toBe('-7')
    expect(formatPoints(0)).toBe('0')
  })
})
