import { createSignal } from '@/shared/state/signalBus'
import type { SessionRecord } from '@/shared/storage/records'

export type DebriefStatus = 'idle' | 'loading' | 'ready' | 'failed'

export interface RecapState {
  /** The just-ended session's stored record (id set once persisted). */
  record: SessionRecord | null
  debriefStatus: DebriefStatus
}

export const recapSignal = createSignal<RecapState>({ record: null, debriefStatus: 'idle' })
