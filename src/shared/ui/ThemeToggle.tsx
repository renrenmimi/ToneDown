import { useCallback, useState } from 'react'
import { applyTheme, readTheme, type Theme } from './theme'

export function ThemeToggle({ ariaLabel }: { ariaLabel: string }) {
  const [theme, setTheme] = useState<Theme>(() => readTheme())

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark'
      applyTheme(next)
      return next
    })
  }, [])

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={ariaLabel}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line bg-raised text-sm text-ink-secondary shadow-e1 transition hover:text-ink"
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  )
}
