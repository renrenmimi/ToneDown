export type Theme = 'dark' | 'light'

const STORAGE_KEY = 'tonedown.theme.v1'
const THEME_COLOR: Record<Theme, string> = { dark: '#0a1422', light: '#f4f8f9' }

/** Mirrors the inline pre-paint bootstrap in index.html. */
export function readTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'dark' || stored === 'light') {
      return stored
    }
  } catch {
    // fall through
  }
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', THEME_COLOR[theme])
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // non-persistent is fine
  }
}
