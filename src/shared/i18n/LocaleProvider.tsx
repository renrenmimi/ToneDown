import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { LocaleContext, type Locale } from './localeContext'

const STORAGE_KEY = 'tonedown.locale.v1'

function readInitialLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'zh-CN' || stored === 'en-US') {
      return stored
    }
  } catch {
    // Private browsing or storage disabled: fall through to the default.
  }
  // English by default; Chinese stays one tap away (user decision, M2).
  return 'en-US'
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(readInitialLocale)

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Non-persistent is fine.
    }
  }, [])

  // Keeps CJK line-breaking, font selection, and screen readers correct.
  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale])

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}
