import { describe, expect, it } from 'vitest'
import { createStore } from './storage'
import {
  EMPTY_SRS,
  Grade,
  dueItems,
  gradeFor,
  introducedOn,
  loadSrs,
  review,
  saveSrs,
  weakFeatures,
} from './srs'

const DAY = 24 * 60 * 60 * 1000
const t0 = new Date('2026-10-20T09:00:00')
const later = (ms: number) => new Date(t0.getTime() + ms)
const ids = { itemKey: 'noun:x|gen.sg', featureKey: 'decl2-mf:gen.sg' }

describe('gradeFor', () => {
  it('right is Good, right only by the setting is Hard, wrong is Again', () => {
    expect(gradeFor(true, false)).toBe(Grade.Good)
    expect(gradeFor(true, true)).toBe(Grade.Hard)
    expect(gradeFor(false, false)).toBe(Grade.Again)
    expect(gradeFor(false, true)).toBe(Grade.Again)
  })
})

describe('review (fake clock)', () => {
  it('creates both cards on the first answer and schedules them', () => {
    const s = review(EMPTY_SRS, ids, Grade.Good, t0)
    expect(Object.keys(s.cards).sort()).toEqual([`f:${ids.featureKey}`, `i:${ids.itemKey}`])
    const item = s.cards[`i:${ids.itemKey}`]
    expect(item.reps).toBe(1)
    expect(new Date(item.due).getTime()).toBeGreaterThan(t0.getTime())
  })
  it('spaces correct answers further and further apart', () => {
    let s = review(EMPTY_SRS, ids, Grade.Good, t0)
    const gaps: number[] = []
    let now = t0
    for (let i = 0; i < 4; i++) {
      now = new Date(s.cards[`i:${ids.itemKey}`].due)
      s = review(s, ids, Grade.Good, now)
      gaps.push(new Date(s.cards[`i:${ids.itemKey}`].due).getTime() - now.getTime())
    }
    for (let i = 1; i < gaps.length; i++) expect(gaps[i]).toBeGreaterThan(gaps[i - 1])
    expect(gaps[gaps.length - 1]).toBeGreaterThan(DAY)
  })
  it('a wrong answer brings the item back soon and counts a lapse', () => {
    let s = review(EMPTY_SRS, ids, Grade.Good, t0)
    s = review(s, ids, Grade.Good, later(DAY))
    s = review(s, ids, Grade.Good, later(4 * DAY))
    const before = s.cards[`i:${ids.itemKey}`]
    const now = new Date(before.due)
    s = review(s, ids, Grade.Again, now)
    const after = s.cards[`i:${ids.itemKey}`]
    expect(after.lapses).toBe(before.lapses + 1)
    expect(new Date(after.due).getTime() - now.getTime()).toBeLessThan(DAY)
  })
  it('Hard schedules sooner than Good', () => {
    const base = review(review(EMPTY_SRS, ids, Grade.Good, t0), ids, Grade.Good, later(DAY))
    const now = later(5 * DAY)
    const hard = new Date(review(base, ids, Grade.Hard, now).cards[`i:${ids.itemKey}`].due).getTime()
    const good = new Date(review(base, ids, Grade.Good, now).cards[`i:${ids.itemKey}`].due).getTime()
    expect(hard).toBeLessThan(good)
  })
  it('counts the new cards Review introduces per local day', () => {
    let s = review(EMPTY_SRS, ids, Grade.Good, t0, { introduced: true })
    s = review(s, { ...ids, itemKey: 'noun:y|gen.sg' }, Grade.Good, t0, { introduced: true })
    s = review(s, { ...ids, itemKey: 'noun:z|gen.sg' }, Grade.Good, t0)
    s = review(s, ids, Grade.Good, t0, { introduced: true }) // not new any more
    expect(introducedOn(s, t0)).toBe(2)
    expect(introducedOn(s, later(DAY))).toBe(0)
  })
  it('does not change the state it is given', () => {
    const s = review(EMPTY_SRS, ids, Grade.Good, t0)
    const copy = JSON.stringify(s)
    review(s, ids, Grade.Again, later(DAY))
    expect(JSON.stringify(s)).toBe(copy)
    expect(EMPTY_SRS.cards).toEqual({})
  })
})

describe('due items and weak features', () => {
  it('lists item cards that are due, earliest first', () => {
    let s = review(EMPTY_SRS, ids, Grade.Good, t0)
    s = review(s, { itemKey: 'noun:y|gen.sg', featureKey: ids.featureKey }, Grade.Again, t0)
    expect(dueItems(s, t0)).toEqual([])
    expect(dueItems(s, later(30 * DAY))).toEqual(['noun:y|gen.sg', ids.itemKey])
  })
  it('finds feature cells that are slipping', () => {
    let s = review(EMPTY_SRS, ids, Grade.Good, t0)
    s = review(s, { itemKey: 'noun:a|dat.pl', featureKey: 'decl2-mf:dat.pl' }, Grade.Good, t0)
    s = review(s, { itemKey: 'noun:a|dat.pl', featureKey: 'decl2-mf:dat.pl' }, Grade.Again, later(60_000))
    expect(weakFeatures(s, later(120_000))).toEqual(['decl2-mf:dat.pl'])
    expect(weakFeatures(s, later(400 * DAY))).toContain(ids.featureKey)
  })
})

describe('storage', () => {
  it('round-trips through the store', () => {
    const store = createStore(null)
    const s = review(EMPTY_SRS, ids, Grade.Good, t0, { introduced: true })
    saveSrs(store, s)
    expect(loadSrs(store)).toEqual(s)
  })
  it('drops malformed cards and falls back to empty', () => {
    const store = createStore(null)
    store.write('srs', { cards: { ok: review(EMPTY_SRS, ids, Grade.Good, t0).cards[`i:${ids.itemKey}`], bad: { due: 'nope' } }, introduced: 3 })
    const s = loadSrs(store)
    expect(Object.keys(s.cards)).toEqual(['ok'])
    expect(s.introduced).toEqual({})
    store.write('srs', 'garbage')
    expect(loadSrs(store)).toEqual(EMPTY_SRS)
  })
})
