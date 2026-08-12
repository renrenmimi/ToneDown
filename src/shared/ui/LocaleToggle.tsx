import { useLocale } from '@/shared/i18n/localeContext'

/* The two labels are metrically unequal — 中 is one full-width CJK glyph resolved
   from the system stack, EN is two Latin glyphs from Source Sans. Left to shrink
   -wrap they produce pills of different widths sitting on mismatched baselines,
   so both segments get a fixed box and are centred as flex children instead. */
const OPTIONS = [
  { locale: 'zh-CN', label: '中', lang: 'zh-Hans' },
  { locale: 'en-US', label: 'EN', lang: 'en' },
] as const

export function LocaleToggle() {
  const { locale, setLocale } = useLocale()

  return (
    <div
      role="group"
      aria-label={locale === 'zh-CN' ? '语言' : 'Language'}
      className="inline-flex h-8 shrink-0 items-center gap-0.5 rounded-full border border-line-strong bg-sunken/80 p-1"
    >
      {OPTIONS.map((option) => (
        <button
          key={option.locale}
          type="button"
          lang={option.lang}
          className={`flex h-6 w-9 items-center justify-center rounded-full text-xs font-semibold leading-none transition ${
            locale === option.locale
              ? 'bg-brand text-surface'
              : 'text-ink-secondary hover:text-ink'
          }`}
          onClick={() => setLocale(option.locale)}
          aria-pressed={locale === option.locale}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
