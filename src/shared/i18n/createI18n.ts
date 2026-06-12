import { useLocale, type Locale } from './localeContext'

/**
 * Typed string-catalog factory — the whole i18n "framework".
 *
 * Each feature defines one catalog object per locale; the shared shape is
 * enforced structurally (`Record<Locale, T>` with `T` inferred from the
 * first entry, pinned by `satisfies` at the call site), so a missing key,
 * a missing locale, or a wrong param signature is a compile error. Strings
 * with parameters are plain functions in the catalog. No runtime parser,
 * no untyped keys, 0KB of library.
 */
export function createI18n<T>(catalog: Record<Locale, T>) {
  function useT(): T {
    return catalog[useLocale().locale]
  }

  /** Non-hook access for code outside React (machine effects, canvas). */
  function t(locale: Locale): T {
    return catalog[locale]
  }

  return { useT, t }
}
