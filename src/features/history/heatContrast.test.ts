import { describe, expect, it } from 'vitest'
import { heatColor, heatInk } from './chartData'

// The score badge paints heatInk on heatColor. WCAG AA for 14px bold text is
// 4.5:1 — the badge previously pinned a near-black ink across the whole scale,
// so a heated session's score rendered at 1.21:1.
const WCAG_AA_NORMAL = 4.5

function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}

function contrastRatio(a: string, b: string): number {
  const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x)
  return (lighter + 0.05) / (darker + 0.05)
}

describe('history score badge contrast', () => {
  it.each([0, 10, 25, 40, 50, 60, 74, 75, 90, 100])(
    'clears WCAG AA at calmScore %i',
    (score) => {
      const ratio = contrastRatio(heatColor(score), heatInk(score))
      expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL)
    },
  )

  it('falls back to theme tokens when there is no score', () => {
    expect(heatColor(null)).toBe('var(--surface-sunken)')
    expect(heatInk(null)).toBe('var(--text-primary)')
  })
})
