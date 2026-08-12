import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'wouter'
import { useLocale } from '@/shared/i18n/localeContext'
import type { SessionRecord } from '@/shared/storage/records'
import { Aurora } from '@/shared/ui/Aurora'
import { LocaleToggle } from '@/shared/ui/LocaleToggle'
import { ThemeToggle } from '@/shared/ui/ThemeToggle'
import { CalendarHeatmap, TrendChart } from './charts'
import { bucketByDay, heatColor } from './chartData'
import { useHistoryT } from './i18n'

const HOLD_MS = 1_500

function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

/**
 * Hold-to-confirm destructive button: 1.5s sustained press fills a progress
 * bar before deleteEverything fires. Keyboard: hold Enter/Space.
 */
function HoldToDelete({ label, hint, onConfirm }: { label: string; hint: string; onConfirm: () => void }) {
  const [progress, setProgress] = useState(0)
  const timerRef = useRef<number | null>(null)
  const startedAtRef = useRef(0)

  const cancel = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
    setProgress(0)
  }, [])

  const start = useCallback(() => {
    if (timerRef.current !== null) {
      return
    }
    startedAtRef.current = Date.now()
    timerRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startedAtRef.current
      setProgress(Math.min(1, elapsed / HOLD_MS))
      if (elapsed >= HOLD_MS) {
        cancel()
        onConfirm()
      }
    }, 50)
  }, [cancel, onConfirm])

  useEffect(() => cancel, [cancel])

  return (
    <div>
      <button
        type="button"
        className="relative overflow-hidden rounded-full border border-line-strong bg-sunken px-6 py-3 text-sm font-semibold text-ink-secondary transition hover:text-ink"
        onPointerDown={start}
        onPointerUp={cancel}
        onPointerLeave={cancel}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') start()
        }}
        onKeyUp={cancel}
      >
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 bg-tone-hostile/25"
          style={{ width: `${progress * 100}%` }}
        />
        <span className="relative">{label}</span>
      </button>
      <p className="mt-2 text-xs text-ink-muted">{hint}</p>
    </div>
  )
}

export default function HistoryPage() {
  const copy = useHistoryT()
  const { locale } = useLocale()
  const [records, setRecords] = useState<SessionRecord[] | null>(null)

  const load = useCallback(async () => {
    try {
      const { getDb } = await import('@/shared/storage/db')
      const sessions = await getDb().sessions.orderBy('startedAt').toArray()
      setRecords(sessions)
    } catch {
      setRecords([])
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const exportJson = useCallback(async () => {
    const { exportAllAsBlob } = await import('@/shared/storage/maintenance')
    const blob = await exportAllAsBlob()
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `tonedown-export-${new Date().toISOString().slice(0, 10)}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }, [])

  const deleteAll = useCallback(async () => {
    const { deleteEverything } = await import('@/shared/storage/maintenance')
    await deleteEverything()
    void load()
  }, [load])

  const buckets = records ? bucketByDay(records) : new Map()

  return (
    <div className="min-h-screen text-ink">
      <Aurora />
      <div className="mx-auto w-full max-w-md px-4 pb-16 pt-6">
        <nav className="mb-5 flex items-center justify-between">
          <Link href="/app" className="text-sm font-semibold text-brand hover:brightness-110">
            ← {copy.back}
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle ariaLabel={copy.themeToggle} />
            <LocaleToggle />
          </div>
        </nav>

        <h1 className="font-display text-3xl font-bold tracking-tight">{copy.title}</h1>

        {records !== null && records.length === 0 && (
          <p className="mt-6 rounded-card border border-line bg-raised/80 p-5 text-sm text-ink-secondary">
            {copy.empty}
          </p>
        )}

        {records !== null && records.length > 0 && (
          <>
            <section className="mt-6 rounded-sheet border border-line bg-raised/80 p-5 shadow-e2 backdrop-blur">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-ink-secondary">{copy.heatmapTitle}</p>
                <p className="text-xs text-ink-muted">{copy.sessionsCount(records.length)}</p>
              </div>
              <div className="mt-3">
                <CalendarHeatmap buckets={buckets} cellLabel={copy.heatmapCellLabel} />
              </div>
              <div className="mt-2 flex items-center justify-end gap-1 text-[10px] text-ink-muted">
                <span>{copy.legendLess}</span>
                {[0, 25, 50, 75, 100].map((v) => (
                  <span
                    key={v}
                    className="inline-block h-2.5 w-2.5 rounded-[3px]"
                    style={{ background: heatColor(v) }}
                  />
                ))}
                <span>{copy.legendMore}</span>
              </div>
            </section>

            {records.length >= 2 && (
              <section className="mt-4 rounded-sheet border border-line bg-raised/80 p-5 shadow-e2 backdrop-blur">
                <p className="text-sm font-medium text-ink-secondary">{copy.trendTitle}</p>
                <div className="mt-2">
                  <TrendChart records={records} />
                </div>
              </section>
            )}

            <section className="mt-4 space-y-2">
              {records
                .slice()
                .reverse()
                .map((record) => (
                  <div
                    key={record.id}
                    className="flex items-center justify-between rounded-card border border-line bg-raised/80 p-4"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-ink">
                        {new Date(record.startedAt).toLocaleString(locale, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                        <span className="ml-2 text-xs text-ink-muted">
                          {formatDuration(record.durationMs)}
                        </span>
                      </p>
                      {record.debrief && (
                        <p className="mt-1 truncate text-xs text-ink-muted">
                          {record.debrief.summary}
                        </p>
                      )}
                    </div>
                    <span
                      className="ml-3 shrink-0 rounded-full px-2.5 py-1 font-display text-sm font-bold tabular-nums"
                      style={{ background: heatColor(record.calmScore), color: '#06251f' }}
                    >
                      {record.calmScore}
                    </span>
                  </div>
                ))}
            </section>

            <section className="mt-8 flex flex-wrap items-start gap-4">
              <button
                type="button"
                className="rounded-full border border-line-strong bg-raised/70 px-6 py-3 text-sm font-semibold text-ink-secondary transition hover:text-ink"
                onClick={() => {
                  void exportJson()
                }}
              >
                {copy.exportJson}
              </button>
              <HoldToDelete
                label={copy.deleteAll}
                hint={copy.deleteHint}
                onConfirm={() => {
                  void deleteAll()
                }}
              />
            </section>
          </>
        )}
      </div>
    </div>
  )
}
