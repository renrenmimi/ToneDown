import { describe, expect, it } from 'vitest'
import { computeCalmScore, downsampleSeries } from './records'

describe('downsampleSeries', () => {
  it('returns short series unchanged', () => {
    const series: [number, number][] = [
      [0, 30],
      [2000, 40],
    ]
    expect(downsampleSeries(series, 200)).toBe(series)
  })

  it('downsamples to the requested point count preserving order', () => {
    const series: [number, number][] = Array.from({ length: 300 }, (_, i) => [i * 2000, i % 100])
    const out = downsampleSeries(series, 60)
    expect(out).toHaveLength(60)
    expect(out[0][0]).toBe(0)
    for (let i = 1; i < out.length; i += 1) {
      expect(out[i][0]).toBeGreaterThan(out[i - 1][0])
    }
  })
})

describe('computeCalmScore', () => {
  it('inverts the mean fused score', () => {
    expect(computeCalmScore([30, 30, 30])).toBe(70)
    expect(computeCalmScore([80, 100, 90])).toBe(10)
  })

  it('treats an empty session as fully calm', () => {
    expect(computeCalmScore([])).toBe(100)
  })
})
