// Everything an answer changes (the attempt log and the spaced-repetition cards), and progress
// export / import as a JSON file (SPEC §8).

import { type Attempt, recordAttempt } from './attempts'
import { loadSettings } from './settings'
import { type Grade, loadSrs, parseSrs, review, saveSrs } from './srs'
import { type Store, createStore } from './storage'

/** `introduced`: the answer is Review's first showing of a new item (counts against the daily limit). */
export function answer(store: Store, attempt: Attempt, grade: Grade, opts: { introduced?: boolean } = {}): void {
  recordAttempt(store, attempt)
  saveSrs(store, review(loadSrs(store), attempt, grade, new Date(attempt.ts), opts))
}

/** Every key the app keeps in the store. */
export const PROGRESS_KEYS = ['settings', 'attempts', 'srs', 'sprint.best', 'fill.difficulty'] as const

const APP = 'attic-greek-game'
const VERSION = 1

export interface ProgressFile {
  app: typeof APP
  version: typeof VERSION
  exportedAt: string
  data: Partial<Record<(typeof PROGRESS_KEYS)[number], unknown>>
}

export function exportProgress(store: Store, now: Date): ProgressFile {
  const data: ProgressFile['data'] = {}
  for (const key of PROGRESS_KEYS) {
    const value = store.read<unknown>(key, null)
    if (value !== null) data[key] = value
  }
  return { app: APP, version: VERSION, exportedAt: now.toISOString(), data }
}

const MODES = ['parse', 'fill', 'make', 'sprint', 'review']

function isAttempt(v: unknown): v is Attempt {
  if (!v || typeof v !== 'object') return false
  const a = v as Record<string, unknown>
  return (
    typeof a.itemKey === 'string' &&
    typeof a.featureKey === 'string' &&
    typeof a.correct === 'boolean' &&
    (a.errorKind === null || typeof a.errorKind === 'string') &&
    typeof a.ts === 'number' &&
    MODES.includes(a.mode as string)
  )
}

const isRecord = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v)

export type ImportResult = { ok: true; answers: number } | { ok: false; reason: string }

/** Replace the stored progress with a file's; malformed entries are dropped, the rest validated. */
export function importProgress(store: Store, text: string): ImportResult {
  let file: unknown
  try {
    file = JSON.parse(text)
  } catch {
    return { ok: false, reason: 'The file is not valid JSON.' }
  }
  if (!isRecord(file) || file.app !== APP) return { ok: false, reason: 'This is not a progress file from this game.' }
  if (file.version !== VERSION) return { ok: false, reason: 'This progress file comes from another version of the game.' }
  if (!isRecord(file.data)) return { ok: false, reason: 'The progress file has no data.' }
  const data = file.data

  const attempts = Array.isArray(data.attempts) ? data.attempts.filter(isAttempt) : []
  const best = isRecord(data['sprint.best'])
    ? Object.fromEntries(Object.entries(data['sprint.best']).filter(([, n]) => typeof n === 'number'))
    : null
  // settings go through the same validation as on start-up
  const scratch = createStore(null)
  if (isRecord(data.settings)) scratch.write('settings', data.settings)

  for (const key of PROGRESS_KEYS) store.remove(key)
  store.write('settings', loadSettings(scratch))
  if (attempts.length) store.write('attempts', attempts)
  if (data.srs !== undefined) saveSrs(store, parseSrs(data.srs))
  if (best) store.write('sprint.best', best)
  if (['few', 'half', 'all'].includes(data['fill.difficulty'] as string)) store.write('fill.difficulty', data['fill.difficulty'])
  return { ok: true, answers: attempts.length }
}
