import Dexie, { type EntityTable } from 'dexie'
import type {
  DrillProgressRecord,
  GymGradeCacheRecord,
  SessionRecord,
  SparringRoundRecord,
} from './records'

// All history is local: IndexedDB via Dexie, no accounts, no server storage.
// This module must only be imported DYNAMICALLY from non-critical paths
// (recap persistence, history page) so dexie stays off the live-session
// critical chunk.

export type ToneDownDb = Dexie & {
  sessions: EntityTable<SessionRecord, 'id'>
  sparRounds: EntityTable<SparringRoundRecord, 'id'>
  drills: EntityTable<DrillProgressRecord, 'id'>
  gradeCache: EntityTable<GymGradeCacheRecord, 'key'>
}

let instance: ToneDownDb | null = null

export function getDb(): ToneDownDb {
  if (instance) {
    return instance
  }
  const db = new Dexie('tonedown') as ToneDownDb
  db.version(1).stores({
    sessions: '++id, startedAt',
    sparRounds: '++id, endedAt, personaId',
    drills: '++id, date, drillId',
    gradeCache: 'key, createdAt',
  })
  instance = db
  return instance
}

/** Test-only: reset the singleton (e.g. after deleteAll). */
export function resetDbInstance(): void {
  instance = null
}
