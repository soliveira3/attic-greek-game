// The attempt log: every answer in every mode (PLAN Phase 4), the input for spaced repetition and
// statistics (Phase 5).

import type { ErrorKind } from './check'
import type { Store } from './storage'

export type Mode = 'parse' | 'fill' | 'make' | 'sprint' | 'review'

export interface Attempt {
  /** Lemma × cell: `pos:lemma|cell` (data.lemmaRef + cell key). */
  itemKey: string
  /** Class × cell: features.featureKey. */
  featureKey: string
  correct: boolean
  errorKind: ErrorKind | null
  ts: number
  mode: Mode
}

export const MAX_ATTEMPTS = 5000
const KEY = 'attempts'

export function itemKey(lemmaRef: string, cell: string): string {
  return `${lemmaRef}|${cell}`
}

export function loadAttempts(store: Store): Attempt[] {
  const raw = store.read<unknown>(KEY, [])
  return Array.isArray(raw) ? (raw as Attempt[]) : []
}

export function recordAttempt(store: Store, attempt: Attempt): void {
  store.write(KEY, [...loadAttempts(store), attempt].slice(-MAX_ATTEMPTS))
}
