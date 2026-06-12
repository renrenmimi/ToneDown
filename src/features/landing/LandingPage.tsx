import { Link } from 'wouter'
import { useLocale } from '@/shared/i18n/localeContext'
import { Aurora } from '@/shared/ui/Aurora'
import { ThemeToggle } from '@/shared/ui/ThemeToggle'
import { ScriptedHeroGauge } from './ScriptedHeroGauge'
import { useLandingT } from './i18n'

export default function LandingPage() {
  const copy = useLandingT()
  const { locale, setLocale } = useLocale()

  return (
    <div className="min-h-screen text-ink">
      <Aurora />

      <div className="mx-auto w-full max-w-5xl px-5 pb-16 pt-6">
        <nav className="flex items-center justify-between">
          <span className="font-display text-2xl font-bold tracking-tight text-brand">
            ToneDown
          </span>
          <div className="flex items-center gap-2">
            <ThemeToggle ariaLabel={copy.themeToggle} />
            <div className="rounded-full border border-line-strong bg-sunken/80 p-1">
              <button
                type="button"
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  locale === 'zh-CN' ? 'bg-brand text-surface' : 'text-ink-secondary hover:text-ink'
                }`}
                onClick={() => setLocale('zh-CN')}
                aria-pressed={locale === 'zh-CN'}
              >
                中
              </button>
              <button
                type="button"
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  locale === 'en-US' ? 'bg-brand text-surface' : 'text-ink-secondary hover:text-ink'
                }`}
                onClick={() => setLocale('en-US')}
                aria-pressed={locale === 'en-US'}
              >
                EN
              </button>
            </div>
          </div>
        </nav>

        {/* hero */}
        <section className="mt-14 grid items-center gap-10 md:grid-cols-2">
          <div>
            <h1 className="font-display text-4xl font-bold leading-tight tracking-tight md:text-5xl">
              {copy.heroTitle}
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-ink-secondary">
              {copy.heroSub}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/app"
                className="rounded-full bg-accent-fill px-7 py-3 text-sm font-semibold text-on-accent shadow-e2 transition hover:brightness-110"
              >
                {copy.ctaLive}
              </Link>
              <a
                href="#how"
                className="rounded-full border border-line-strong bg-raised/70 px-7 py-3 text-sm font-semibold text-ink-secondary transition hover:text-ink"
              >
                {copy.ctaHow}
              </a>
            </div>
          </div>
          <ScriptedHeroGauge />
        </section>

        {/* how it works */}
        <section id="how" className="mt-24">
          <h2 className="font-display text-2xl font-bold">{copy.how.title}</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {copy.how.cards.map((card) => (
              <div
                key={card.title}
                className="rounded-card border border-line bg-raised/80 p-6 shadow-e1 backdrop-blur"
              >
                <h3 className="font-display text-lg font-semibold text-brand">{card.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-secondary">{card.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* engineers */}
        <section className="mt-24 rounded-sheet border border-line bg-raised/80 p-7 shadow-e2 backdrop-blur">
          <h2 className="font-display text-2xl font-bold">{copy.engineers.title}</h2>
          <p className="mt-2 text-sm text-ink-secondary">{copy.engineers.intro}</p>

          <div className="mt-6 flex flex-col items-stretch gap-2 text-center md:flex-row md:items-center">
            {(
              [
                [copy.engineers.boxes.client, copy.engineers.clientDetail],
                [copy.engineers.boxes.proxy, copy.engineers.proxyDetail],
                [copy.engineers.boxes.groq, copy.engineers.groqDetail],
              ] as const
            ).map(([title, detail], i) => (
              <div key={title} className="contents">
                {i > 0 && (
                  <span aria-hidden className="self-center font-display text-ink-muted">
                    →
                  </span>
                )}
                <div className="flex-1 rounded-card border border-line bg-sunken/60 p-4">
                  <p className="font-display text-sm font-semibold text-ink">{title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-ink-muted">{detail}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            {copy.engineers.fallbackTitle}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {copy.engineers.fallbackChips.map((chip) => (
              <span
                key={chip}
                className="rounded-full border border-brand/40 bg-brand/10 px-3 py-1 text-xs text-brand"
              >
                {chip}
              </span>
            ))}
          </div>
          <p className="mt-3 text-xs text-ink-muted">{copy.engineers.footnote}</p>
        </section>

        {/* privacy strip */}
        <section className="mt-16 rounded-card border border-line bg-sunken/50 p-5 text-center">
          <p className="text-sm text-ink-secondary">{copy.privacy}</p>
        </section>

        <footer className="mt-16 text-center text-xs text-ink-muted">{copy.notCounseling}</footer>
      </div>
    </div>
  )
}
