import { createContext, useContext } from 'react'
import type { AppLanguage } from '@/types/app'

export type Locale = AppLanguage

export interface LocaleContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
}

export const LocaleContext = createContext<LocaleContextValue | null>(null)

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext)
  if (!ctx) {
    throw new Error('useLocale must be used within a LocaleProvider')
  }
  return ctx
}
