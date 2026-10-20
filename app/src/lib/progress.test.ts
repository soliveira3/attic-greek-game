import { describe, expect, it } from 'vitest'
import { loadAttempts } from './attempts'
import { PROGRESS_KEYS, answer, exportProgress, importProgress } from './progress'
import { DEFAULT_SETTINGS, loadSettings } from './settings'
import { Grade, introducedOn, loadSrs } from './srs'
import { createStore } from './storage'

const t0 = new Date('2026-10-20T09:00:00')

describe('answer', () => {
  it('records the attempt and updates the item and feature cards', () => {
    const store = createStore(null)
    const attempt = { itemKey: 'noun:x|gen.sg', featureKey: 'decl2-mf:gen.sg', correct: true, errorKind: null, ts: t0.getTime(), mode: 'make' as const }
    answer(store, attempt, Grade.Good)
    expect(loadAttempts(store)).toEqual([attempt])
    const srs = loadSrs(store)
    expect(Object.keys(srs.cards).sort()).toEqual(['f:decl2-mf:gen.sg', 'i:noun:x|gen.sg'])
    expect(introducedOn(srs, t0)).toBe(0)
    answer(store, { ...attempt, itemKey: 'noun:y|gen.sg', mode: 'review' }, Grade.Good, { introduced: true })
    expect(introducedOn(loadSrs(store), t0)).toBe(1)
  })
})

describe('export and import', () => {
  function filled() {
    const store = createStore(null)
    answer(store, { itemKey: 'noun:x|gen.sg', featureKey: 'decl2-mf:gen.sg', correct: true, errorKind: null, ts: t0.getTime(), mode: 'make' }, Grade.Good)
    store.write('settings', { ...DEFAULT_SETTINGS, strictness: 'strict' })
    store.write('sprint.best', { 'x:decl2-mf': 12 })
    store.write('fill.difficulty', 'half')
    return store
  }
  it('round-trips everything the app stores', () => {
    const from = filled()
    const file = exportProgress(from, t0)
    expect(file).toMatchObject({ app: 'attic-greek-game', version: 1, exportedAt: t0.toISOString() })
    const to = createStore(null)
    expect(importProgress(to, JSON.stringify(file))).toEqual({ ok: true, answers: 1 })
    for (const key of PROGRESS_KEYS) expect(to.read(key, null)).toEqual(from.read(key, null))
  })
  it('replaces what was there, leaving defaults for what the file lacks', () => {
    const to = filled()
    const result = importProgress(to, JSON.stringify({ app: 'attic-greek-game', version: 1, exportedAt: t0.toISOString(), data: {} }))
    expect(result).toEqual({ ok: true, answers: 0 })
    expect(loadAttempts(to)).toEqual([])
    expect(loadSettings(to)).toEqual(DEFAULT_SETTINGS)
    expect(to.read('sprint.best', null)).toBeNull()
  })
  it('refuses files that are not progress files', () => {
    const to = filled()
    expect(importProgress(to, '{nope')).toEqual({ ok: false, reason: 'The file is not valid JSON.' })
    expect(importProgress(to, JSON.stringify({ app: 'other', version: 1, data: {} }))).toMatchObject({ ok: false })
    expect(importProgress(to, JSON.stringify({ app: 'attic-greek-game', version: 99, data: {} }))).toMatchObject({ ok: false })
    expect(importProgress(to, JSON.stringify({ app: 'attic-greek-game', version: 1 }))).toMatchObject({ ok: false })
    expect(loadAttempts(to)).toHaveLength(1)
  })
  it('drops malformed entries', () => {
    const to = createStore(null)
    const data = {
      attempts: [{ itemKey: 'a', featureKey: 'b', correct: true, errorKind: null, ts: 1, mode: 'make' }, { itemKey: 3 }, null],
      srs: { cards: { bad: {} } },
      'sprint.best': { ok: 3, bad: 'x' },
      'fill.difficulty': 'impossible',
      settings: { strictness: 'nonsense' },
    }
    expect(importProgress(to, JSON.stringify({ app: 'attic-greek-game', version: 1, data }))).toEqual({ ok: true, answers: 1 })
    expect(loadSrs(to).cards).toEqual({})
    expect(to.read('sprint.best', null)).toEqual({ ok: 3 })
    expect(to.read('fill.difficulty', null)).toBeNull()
    expect(loadSettings(to).strictness).toBe(DEFAULT_SETTINGS.strictness)
  })
})
