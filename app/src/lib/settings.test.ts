import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from './settings'
import { createStore } from './storage'

describe('settings', () => {
  it('defaults: ignore accents, nouns, adjectives, article and verbs, no dual', () => {
    expect(DEFAULT_SETTINGS.strictness).toBe('ignore-accents')
    expect(DEFAULT_SETTINGS.scope.dual).toBe(false)
    expect(loadSettings(createStore(null))).toEqual(DEFAULT_SETTINGS)
  })
  it('round-trips through the store', () => {
    const store = createStore(null)
    const s = { ...DEFAULT_SETTINGS, strictness: 'strict' as const, scope: { ...DEFAULT_SETTINGS.scope, tenses: ['aor' as const] } }
    saveSettings(store, s)
    expect(loadSettings(store)).toEqual(s)
  })
  it('drops unknown or invalid stored values', () => {
    const store = createStore(null)
    store.write('settings', { strictness: 'whatever', scope: { pos: ['noun', 'bogus'], dual: 'yes' }, lengthMarks: false })
    const s = loadSettings(store)
    expect(s.strictness).toBe(DEFAULT_SETTINGS.strictness)
    expect(s.scope.pos).toEqual(['noun'])
    expect(s.scope.dual).toBe(false)
    expect(s.lengthMarks).toBe(false)
  })
  it('keeps a daily new-card limit between 0 and 200', () => {
    const store = createStore(null)
    expect(DEFAULT_SETTINGS.newPerDay).toBe(20)
    for (const [stored, expected] of [[5, 5], [0, 0], [201, 20], [-1, 20], [2.5, 20], ['7', 20]] as const) {
      store.write('settings', { newPerDay: stored })
      expect(loadSettings(store).newPerDay).toBe(expected)
    }
  })
})
