import { describe, expect, it } from 'vitest'
import { loadAttempts } from './attempts'
import { answer } from './progress'
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
