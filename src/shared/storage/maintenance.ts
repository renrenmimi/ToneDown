import { getDb, resetDbInstance } from './db'

const EXPORT_SCHEMA_VERSION = 1

/** One-click local export: every table, schema-versioned, as a JSON blob. */
export async function exportAllAsBlob(): Promise<Blob> {
  const db = getDb()
  const [sessions, sparRounds, drills, gradeCache] = await Promise.all([
    db.sessions.toArray(),
    db.sparRounds.toArray(),
    db.drills.toArray(),
    db.gradeCache.toArray(),
  ])
  const payload = {
    app: 'tonedown',
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    sessions,
    sparRounds,
    drills,
    gradeCache,
  }
  return new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
}

/** Gone is gone: drops the whole database. No cloud, no copies. */
export async function deleteEverything(): Promise<void> {
  const db = getDb()
  await db.delete()
  resetDbInstance()
}
