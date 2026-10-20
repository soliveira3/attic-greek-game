import { describe, expect, it } from 'vitest'
import { MAX_ATTEMPTS, itemKey, loadAttempts, recordAttempt } from './attempts'
import { createStore } from './storage'

describe('attempts', () => {
  it('records attempts in order', () => {
    const store = createStore(null)
    recordAttempt(store, { itemKey: 'noun:x|gen.sg', featureKey: 'decl2-mf:gen.sg', correct: true, errorKind: null, ts: 1, mode: 'make' })
    recordAttempt(store, { itemKey: 'noun:x|dat.sg', featureKey: 'decl2-mf:dat.sg', correct: false, errorKind: 'ending', ts: 2, mode: 'make' })
    expect(loadAttempts(store).map((a) => a.ts)).toEqual([1, 2])
  })
  it('keeps only the most recent attempts', () => {
    const store = createStore(null)
    const attempt = (ts: number) => ({ itemKey: 'i', featureKey: 'f', correct: true, errorKind: null, ts, mode: 'parse' as const })
    store.write('attempts', Array.from({ length: MAX_ATTEMPTS }, (_, i) => attempt(i)))
    for (let i = MAX_ATTEMPTS; i < MAX_ATTEMPTS + 5; i++) recordAttempt(store, attempt(i))
    const all = loadAttempts(store)
    expect(all.length).toBe(MAX_ATTEMPTS)
    expect(all[0].ts).toBe(5)
  })
  it('ignores a corrupt log', () => {
    const store = createStore(null)
    store.write('attempts', { not: 'a list' })
    expect(loadAttempts(store)).toEqual([])
  })
  it('builds item keys from the lemma reference and cell', () => {
    expect(itemKey('noun:λόγος', 'gen.sg')).toBe('noun:λόγος|gen.sg')
  })
})
