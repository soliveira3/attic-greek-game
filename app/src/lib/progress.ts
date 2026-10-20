// Everything an answer changes: the attempt log and the spaced-repetition cards.

import { type Attempt, recordAttempt } from './attempts'
import { type Grade, loadSrs, review, saveSrs } from './srs'
import type { Store } from './storage'

/** `introduced`: the answer is Review's first showing of a new item (counts against the daily limit). */
export function answer(store: Store, attempt: Attempt, grade: Grade, opts: { introduced?: boolean } = {}): void {
  recordAttempt(store, attempt)
  saveSrs(store, review(loadSrs(store), attempt, grade, new Date(attempt.ts), opts))
}
