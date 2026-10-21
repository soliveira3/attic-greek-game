import { describe, expect, it } from 'vitest'
import { testData } from '../test/data'
import type { Attempt } from './attempts'
import { lemmaRef } from './data'
import { lemmasInScope, seededRng } from './prompts'
import {
  LESSONS,
  LESSON_BONUS,
  UNITS,
  buildLesson,
  completeLesson,
  dailyXp,
  emptyPath,
  findLesson,
  lessonState,
  loadPath,
  nextLesson,
  parsePath,
  passed,
  unitSettings,
  unitsInData,
} from './path'
import { DEFAULT_SETTINGS } from './settings'
import { createStore } from './storage'

const units = unitsInData(testData, DEFAULT_SETTINGS)
const day = new Date(2026, 9, 20, 12)

function attempt(correct: boolean, ts: number): Attempt {
  return { itemKey: 'x|y', featureKey: 'a:b', correct, errorKind: correct ? null : 'ending', ts, mode: 'make' }
}

describe('units', () => {
  it('have unique ids, a title, a colour family and a note', () => {
    expect(new Set(UNITS.map((u) => u.id)).size).toBe(UNITS.length)
    for (const u of UNITS) {
      expect(u.title).toBeTruthy()
      expect(u.blurb).toBeTruthy()
      expect(['early', 'decl3', 'adj', 'verb']).toContain(u.family)
    }
  })
  it('each have words in the data', () => {
    expect(units.length).toBe(UNITS.length)
    for (const u of units) expect(lemmasInScope(testData, unitSettings(u, DEFAULT_SETTINGS)).length).toBeGreaterThan(0)
  })
  it('scope each unit to its classes and tenses only, keeping the player’s dual and strictness', () => {
    const verbUnit = UNITS.find((u) => u.id === 'impf-act')!
    const s = unitSettings(verbUnit, { ...DEFAULT_SETTINGS, strictness: 'strict', scope: { ...DEFAULT_SETTINGS.scope, dual: true } })
    expect(s.scope).toEqual({ pos: ['verb'], classes: [], tenses: ['impf'], voices: ['act'], dual: true })
    expect(s.strictness).toBe('strict')
  })
  it('start with the article and the 2nd declension', () => {
    expect(UNITS.slice(0, 2).map((u) => u.id)).toEqual(['article', 'decl2'])
  })
})

describe('lessons', () => {
  it('follow the unit order, five per unit, the last one a unit test', () => {
    expect(LESSONS.length).toBe(UNITS.length * 5)
    expect(LESSONS[0].id).toBe('article.1')
    expect(LESSONS.filter((l) => l.kind === 'test').length).toBe(UNITS.length)
    expect(findLesson('decl2.5')?.kind).toBe('test')
    expect(findLesson('nope.1')).toBeUndefined()
  })

  it('unlock one after the other', () => {
    const path = emptyPath()
    expect(lessonState(path, 'article.1')).toBe('current')
    expect(lessonState(path, 'article.2')).toBe('locked')
    const after = completeLesson(path, 'article.1', { right: 8, total: 8 }, day.getTime())
    expect(lessonState(after, 'article.1')).toBe('done')
    expect(lessonState(after, 'article.2')).toBe('current')
    expect(nextLesson(after)?.id).toBe('article.2')
  })

  it('a failed unit test does not count as done', () => {
    let path = emptyPath()
    for (const l of LESSONS.slice(0, 4)) path = completeLesson(path, l.id, { right: 8, total: 8 }, day.getTime())
    expect(passed('article.5', { right: 7, total: 12 })).toBe(false)
    path = completeLesson(path, 'article.5', { right: 7, total: 12 }, day.getTime())
    expect(lessonState(path, 'article.5')).toBe('current')
    expect(passed('article.5', { right: 10, total: 12 })).toBe(true)
    path = completeLesson(path, 'article.5', { right: 10, total: 12 }, day.getTime())
    expect(lessonState(path, 'decl2.1')).toBe('current')
  })

  it('a unit test passed ahead of time unlocks everything up to the next unit', () => {
    expect(lessonState(emptyPath(), 'decl1f.5')).toBe('jump')
    const path = completeLesson(emptyPath(), 'decl1f.5', { right: 12, total: 12 }, day.getTime())
    expect(lessonState(path, 'decl2.5')).toBe('done')
    expect(lessonState(path, 'decl1f.5')).toBe('done')
    expect(lessonState(path, 'pres-act.1')).toBe('current')
  })

  it('survive a round trip through the store and ignore junk', () => {
    const store = createStore(null)
    expect(loadPath(store)).toEqual(emptyPath())
    store.write('path', { log: [{ lesson: 'article.1', ts: 5, right: 3, total: 4 }, { lesson: 7 }, 'junk'] })
    expect(loadPath(store).log).toEqual([{ lesson: 'article.1', ts: 5, right: 3, total: 4 }])
    expect(parsePath('junk')).toEqual(emptyPath())
  })
})

describe('building a lesson', () => {
  it('is reproducible from a seed and stays in the unit', () => {
    const a = buildLesson(testData, DEFAULT_SETTINGS, findLesson('decl2.3')!, seededRng(1))
    const b = buildLesson(testData, DEFAULT_SETTINGS, findLesson('decl2.3')!, seededRng(1))
    expect(a.map((e) => e.prompt.lemma.lemma)).toEqual(b.map((e) => e.prompt.lemma.lemma))
    expect(a.length).toBe(10)
    for (const e of a) expect(['decl2-mf', 'decl2-n']).toContain(e.prompt.lemma.class)
    expect(new Set(a.map((e) => e.kind))).toEqual(new Set(['parse', 'make']))
  })

  it('starts with the most frequent words and widens the pool lesson by lesson', () => {
    const unit = UNITS.find((u) => u.id === 'decl2')!
    const byRank = lemmasInScope(testData, unitSettings(unit, DEFAULT_SETTINGS)).sort(
      (x, y) => (x.rank ?? Infinity) - (y.rank ?? Infinity),
    )
    const first = buildLesson(testData, DEFAULT_SETTINGS, findLesson('decl2.1')!, seededRng(2))
    const top = new Set(byRank.slice(0, 3).map(lemmaRef))
    for (const e of first) expect(top.has(lemmaRef(e.prompt.lemma))).toBe(true)
    const test = buildLesson(testData, DEFAULT_SETTINGS, findLesson('decl2.5')!, seededRng(2))
    expect(new Set(test.map((e) => lemmaRef(e.prompt.lemma))).size).toBeGreaterThan(3)
  })

  it('does not ask the same item twice in a row', () => {
    const items = buildLesson(testData, DEFAULT_SETTINGS, findLesson('article.2')!, seededRng(3))
    const keys = items.map((e) => (e.kind === 'table' ? '' : e.prompt.itemKey))
    for (let i = 1; i < keys.length; i++) expect(keys[i]).not.toBe(keys[i - 1])
  })

  it('gives tables for the table lesson, verbs one tense-voice block of the unit', () => {
    const items = buildLesson(testData, DEFAULT_SETTINGS, findLesson('aor-act.4')!, seededRng(4))
    expect(items.map((e) => e.kind)).toEqual(['table', 'table'])
    for (const e of items) if (e.kind === 'table') expect(e.prompt.block).toBe('aor.act')
  })
})

describe('XP', () => {
  it('counts right answers and lesson bonuses of the local day', () => {
    const t = day.getTime()
    const yesterday = t - 24 * 3600 * 1000
    const attempts = [attempt(true, t), attempt(false, t), attempt(true, t), attempt(true, yesterday)]
    const path = completeLesson(completeLesson(emptyPath(), 'article.1', { right: 2, total: 3 }, t), 'article.2', { right: 1, total: 1 }, yesterday)
    expect(dailyXp(attempts, path, day)).toBe(2 + LESSON_BONUS)
  })
})
