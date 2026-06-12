import { useEffect } from 'react'
import { sessionStore } from '@/features/live-session/machine/sessionStore'
import type { SessionState } from '@/features/live-session/machine/sessionMachine'
import { useLocale } from '@/shared/i18n/localeContext'
import { debriefEndpoint } from '@/shared/llm/endpoints'
import {
  computeCalmScore,
  downsampleSeries,
  type SessionRecord,
} from '@/shared/storage/records'
import type { DebriefRequest } from '@/types/api'
import { recapSignal } from './recapStore'

const MAX_STORED_SERIES = 200
const MAX_DEBRIEF_ENTRIES = 80
const MAX_DEBRIEF_ENTRY_CHARS = 280
const MAX_DEBRIEF_SERIES = 60
const MIN_ENTRIES_FOR_DEBRIEF = 2

function buildRecord(state: SessionState, language: SessionRecord['language']): SessionRecord {
  const startedAt = state.startedAt ?? Date.now()
  const endedAt = state.endedAt ?? Date.now()
  const series: [number, number][] = state.scoreHistory.map((h) => [
    Math.max(0, h.timestamp - startedAt),
    h.score,
  ])
  return {
    startedAt,
    endedAt,
    durationMs: Math.max(0, endedAt - startedAt),
    language,
    calmScore: computeCalmScore(state.scoreHistory.map((h) => h.score)),
    peakScore: state.scoreHistory.reduce((max, h) => Math.max(max, h.score), 0),
    interventionCount: state.interventionCount,
    scoreSeries: downsampleSeries(series, MAX_STORED_SERIES),
    flaggedMoments: state.flaggedMoments.map((m) => ({
      atMs: Math.max(0, m.at - startedAt),
      quote: m.quote,
      rewrite: m.rewrite,
    })),
    debrief: null,
  }
}

function scoreNear(state: SessionState, timestamp: number): number {
  let best = 30
  for (const point of state.scoreHistory) {
    if (point.timestamp <= timestamp + 2_000) {
      best = point.score
    } else {
      break
    }
  }
  return best
}

function buildDebriefRequest(
  state: SessionState,
  language: DebriefRequest['language'],
  record: SessionRecord,
): DebriefRequest {
  return {
    language,
    durationMs: record.durationMs,
    entries: state.transcript.slice(-MAX_DEBRIEF_ENTRIES).map((entry) => ({
      text: entry.text.slice(0, MAX_DEBRIEF_ENTRY_CHARS),
      score: scoreNear(state, entry.timestamp),
    })),
    scoreSeries: downsampleSeries(record.scoreSeries, MAX_DEBRIEF_SERIES),
  }
}

/**
 * Executes the machine's persistSession/requestDebrief effects. Mounted on
 * /app at all times so handlers are registered before any STOP. Dexie is
 * imported dynamically here so it never rides the live-session critical
 * chunk — persistence is post-session work by definition.
 */
export function useRecapPersistence(): void {
  const { locale } = useLocale()

  useEffect(() => {
    return sessionStore.onEffect((effect) => {
      const state = sessionStore.getState()

      if (effect.kind === 'persistSession') {
        if (state.scoreHistory.length === 0) {
          recapSignal.set({ record: null, debriefStatus: 'idle' })
          return
        }
        const record = buildRecord(state, locale)
        recapSignal.set({ record, debriefStatus: 'idle' })
        void import('@/shared/storage/db')
          .then(async ({ getDb }) => {
            const id = await getDb().sessions.add(record)
            recapSignal.set({
              ...recapSignal.get(),
              record: { ...record, id },
            })
          })
          .catch(() => {
            // Private browsing / quota issues: the in-memory recap still renders.
          })
      }

      if (effect.kind === 'requestDebrief') {
        const current = recapSignal.get()
        const record = current.record ?? buildRecord(state, locale)
        if (
          state.transcript.length < MIN_ENTRIES_FOR_DEBRIEF ||
          !debriefEndpoint.canAttempt()
        ) {
          return
        }
        recapSignal.set({ ...current, debriefStatus: 'loading' })
        void debriefEndpoint
          .call(buildDebriefRequest(state, locale, record))
          .then(async (debrief) => {
            const next = { ...recapSignal.get() }
            if (next.record) {
              next.record = { ...next.record, debrief }
              if (next.record.id !== undefined) {
                const { getDb } = await import('@/shared/storage/db')
                await getDb()
                  .sessions.update(next.record.id, { debrief })
                  .catch(() => undefined)
              }
            }
            recapSignal.set({ ...next, debriefStatus: 'ready' })
          })
          .catch(() => {
            recapSignal.set({ ...recapSignal.get(), debriefStatus: 'failed' })
          })
      }
    })
  }, [locale])
}
