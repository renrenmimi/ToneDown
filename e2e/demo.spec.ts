import { expect, test } from '@playwright/test'

// The portfolio smoke: /demo must replay the full product loop — scoring,
// hostile spike, machine-driven breathing intervention, recap — with ZERO
// network calls to /api. Any API hit fails the test outright.

test('demo replays the full session loop with zero API traffic', async ({ page }) => {
  const apiHits: string[] = []
  await page.route('**/api/**', (route) => {
    apiHits.push(route.request().url())
    void route.abort()
  })
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))

  await page.goto('/demo')

  // Player chrome up and the session machine listening.
  await expect(page.getByText(/Scripted replay|脚本回放/)).toBeVisible()

  // ~10-13s in: the zh hostile spike flags a moment and offers a rewrite.
  await expect(page.getByText(/AI suggestion|AI 建议/)).toBeVisible({ timeout: 20_000 })

  // ~17-20s: sustained hostility trips the machine's own intervention —
  // the gauge morphs into the 4-7-8 breathing guide.
  await expect(page.getByText(/Breathe in|Hold|Let it go|吸气|屏住|缓缓呼出/).first()).toBeVisible({
    timeout: 15_000,
  })

  // ~42s: STOP lands on the recap with the canned debrief.
  await expect(page.getByText(/Calm score|冷静分/)).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText(/One habit to practice|下次练习一个小习惯/i)).toBeVisible()
  await expect(page.getByRole('link', { name: /Try it live|立即体验/ })).toBeVisible()

  expect(apiHits, 'demo mode must never touch /api').toEqual([])
  expect(pageErrors, 'no uncaught page errors').toEqual([])
})
