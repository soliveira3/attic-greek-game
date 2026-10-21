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
  estimateLevel,
  findLesson,
  lessonDone,
  lessonsOf,
  loadPath,
  parsePath,
  passed,
  placementExercises,
  recommend,
  scorePlacement,
  setPlacement,
  unitIndexOf,
  unitSettings,
  unitsInData,
  weakSpot,
  weakSpots,
  xpHistory,
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

  it('are all open; a lesson is done once finished', () => {
    const path = completeLesson(emptyPath(), 'perf.2', { right: 3, total: 8 }, day.getTime())
    expect(lessonDone(path, 'perf.2')).toBe(true)
    expect(lessonDone(path, 'perf.1')).toBe(false)
    expect(lessonDone(path, 'article.1')).toBe(false)
  })

  it('a unit test counts at the pass mark, and then marks its whole unit done', () => {
    expect(passed('article.5', { right: 7, total: 12 })).toBe(false)
    expect(passed('article.5', { right: 10, total: 12 })).toBe(true)
    let path = completeLesson(emptyPath(), 'decl2.5', { right: 7, total: 12 }, day.getTime())
    expect(lessonDone(path, 'decl2.5')).toBe(false)
    path = completeLesson(path, 'decl2.5', { right: 12, total: 12 }, day.getTime())
    for (const l of lessonsOf(UNITS[1])) expect(lessonDone(path, l.id)).toBe(true)
    expect(lessonDone(path, 'article.1')).toBe(false)
  })

  it('survive a round trip through the store and ignore junk', () => {
    const store = createStore(null)
    expect(loadPath(store)).toEqual(emptyPath())
    store.write('path', { log: [{ lesson: 'article.1', ts: 5, right: 3, total: 4 }, { lesson: 7 }, 'junk'] })
    expect(loadPath(store).log).toEqual([{ lesson: 'article.1', ts: 5, right: 3, total: 4 }])
    expect(parsePath('junk')).toEqual(emptyPath())
  })
})

function answered(featureKey: string, correct: boolean, ts = day.getTime(), mode: Attempt['mode'] = 'make'): Attempt {
  return { itemKey: `x|${featureKey}`, featureKey, correct, errorKind: correct ? null : 'ending', ts, mode }
}
const unitAt = (id: string) => UNITS.findIndex((u) => u.id === id)

describe('level and recommendation', () => {
  it('maps a form to its unit', () => {
    expect(unitIndexOf('decl2-mf:gen.sg')).toBe(unitAt('decl2'))
    expect(unitIndexOf('article:gen.pl.f')).toBe(unitAt('article'))
    expect(unitIndexOf('verb-thematic:impf.act.ind.1.sg')).toBe(unitAt('impf-act'))
    expect(unitIndexOf('verb-thematic:pres.mp.inf')).toBe(unitAt('pres-mp'))
    expect(unitIndexOf('verb-thematic:fut.pass.ind.3.sg')).toBe(unitAt('pass'))
    expect(unitIndexOf('nothing:here')).toBe(-1)
  })

  it('starts a newcomer at the beginning', () => {
    expect(estimateLevel(emptyPath(), [])).toBe(-1)
    expect(recommend(emptyPath(), [])).toMatchObject({ lesson: { id: 'article.1' }, level: -1, reason: 'new' })
  })

  it('goes on with the first unfinished lesson', () => {
    const path = completeLesson(emptyPath(), 'article.1', { right: 8, total: 8 }, day.getTime())
    expect(recommend(path, [])).toMatchObject({ lesson: { id: 'article.2' }, reason: 'next' })
  })

  it('after a placement, warms up a little below the level, then moves on', () => {
    const placed = setPlacement(emptyPath(), unitAt('adj-12'), day.getTime())
    expect(estimateLevel(placed, [])).toBe(unitAt('adj-12'))
    expect(recommend(placed, [])).toMatchObject({ lesson: { id: 'adj-12.3' }, reason: 'warm-up' })
    const warmed = completeLesson(placed, 'adj-12.3', { right: 9, total: 10 }, day.getTime())
    expect(recommend(warmed, [])).toMatchObject({ lesson: { id: 'decl1m.1' }, reason: 'next' })
  })

  it('counts a unit as solid from enough good recent answers or a passed unit test', () => {
    const good = Array.from({ length: 12 }, () => answered('decl2-n:dat.pl', true))
    expect(estimateLevel(emptyPath(), good)).toBe(unitAt('decl2'))
    expect(estimateLevel(emptyPath(), good.slice(0, 11))).toBe(-1)
    const mixed = [...good, ...Array.from({ length: 4 }, () => answered('decl2-n:dat.pl', false))]
    expect(estimateLevel(emptyPath(), mixed)).toBe(-1)
    const tested = completeLesson(emptyPath(), 'decl1f.5', { right: 11, total: 12 }, day.getTime())
    expect(estimateLevel(tested, [])).toBe(unitAt('decl1f'))
  })

  it('scores a placement check: the highest unit answered fully right, over after two units missed', () => {
    expect(scorePlacement([])).toEqual({ over: false, level: -1 })
    expect(scorePlacement([{ right: 2, total: 2 }, { right: 1, total: 2 }])).toEqual({ over: false, level: 0 })
    expect(scorePlacement([{ right: 2, total: 2 }, { right: 1, total: 2 }, { right: 2, total: 2 }, { right: 0, total: 2 }])).toEqual({
      over: true,
      level: 2,
    })
    const all = UNITS.map(() => ({ right: 2, total: 2 }))
    expect(scorePlacement(all)).toEqual({ over: true, level: UNITS.length - 1 })
  })

  it('gives two placement exercises per unit: one to parse, one to make', () => {
    const items = placementExercises(testData, DEFAULT_SETTINGS, UNITS[1], seededRng(5))
    expect(items.map((e) => e.kind)).toEqual(['parse', 'make'])
    for (const e of items) expect(['decl2-mf', 'decl2-n']).toContain(e.prompt.lemma.class)
  })

  it('keeps the placement in the store', () => {
    const store = createStore(null)
    store.write('path', { log: [], placement: { level: 3, ts: 9 } })
    expect(loadPath(store).placement).toEqual({ level: 3, ts: 9 })
    store.write('path', { log: [], placement: { level: 'high' } })
    expect(loadPath(store).placement).toBeUndefined()
  })
})

describe('edge cases', () => {
  it('know nothing of lessons that do not exist', () => {
    expect(lessonDone(emptyPath(), 'nope.1')).toBe(false)
    expect(passed('nope.1', { right: 1, total: 1 })).toBe(false)
    expect(passed('article.1', { right: 0, total: 0 })).toBe(false)
  })
  it('ignore old answers and answers outside the path for the level', () => {
    const old = day.getTime() - 40 * 24 * 3600 * 1000
    const attempts = [
      ...Array.from({ length: 12 }, () => answered('decl2-n:dat.pl', true, old)),
      ...Array.from({ length: 12 }, () => answered('elsewhere:x', true)),
    ]
    expect(estimateLevel(emptyPath(), attempts, day)).toBe(-1)
  })
  it('recommend an earlier unfinished lesson once everything after the level is done, and nothing at the very end', () => {
    let path = setPlacement(emptyPath(), 0, day.getTime())
    for (const l of LESSONS.slice(5)) path = completeLesson(path, l.id, { right: 12, total: 12 }, day.getTime())
    path = completeLesson(path, 'article.3', { right: 1, total: 1 }, day.getTime())
    expect(recommend(path, [], day)?.lesson.id).toBe('article.1')
    for (const l of LESSONS.slice(0, 5)) path = completeLesson(path, l.id, { right: 12, total: 12 }, day.getTime())
    expect(recommend(path, [], day)).toBeUndefined()
  })
  it('look up one form, and forms outside the path or without an error kind', () => {
    const attempts = Array.from({ length: 3 }, () => ({ ...answered('elsewhere:x', false), errorKind: null }))
    expect(weakSpot(attempts, 'elsewhere:x', day)).toMatchObject({ unit: undefined, lesson: undefined, misses: 3 })
    expect(weakSpot(attempts, 'decl2-mf:gen.pl', day)).toBeUndefined()
  })
  it('order weak spots with as many misses by the latest miss', () => {
    const t = day.getTime()
    const attempts = [
      ...Array.from({ length: 3 }, () => answered('decl2-mf:gen.pl', false, t - 1000)),
      ...Array.from({ length: 3 }, () => answered('decl2-mf:dat.pl', false, t)),
    ]
    expect(weakSpots(attempts, day).map((w) => w.featureKey)).toEqual(['decl2-mf:dat.pl', 'decl2-mf:gen.pl'])
  })
  it('give the XP of the last seven days, oldest first', () => {
    const t = day.getTime()
    const history = xpHistory([answered('a:b', true, t), answered('a:b', true, t - 2 * 24 * 3600 * 1000)], emptyPath(), day)
    expect(history.map((d) => d.xp)).toEqual([0, 0, 0, 0, 1, 0, 1])
  })
})

describe('weak spots', () => {
  const now = day
  it('are forms missed often lately, pointing to a lesson and a note', () => {
    const attempts = [
      ...Array.from({ length: 4 }, () => answered('decl2-mf:gen.pl', false)),
      answered('decl2-mf:gen.pl', true),
      ...Array.from({ length: 3 }, () => answered('verb-thematic:aor.act.ind.3.sg', false, day.getTime(), 'parse')),
      ...Array.from({ length: 2 }, () => answered('decl1-eta:dat.sg', false)),
    ]
    const spots = weakSpots(attempts, now)
    expect(spots.map((w) => w.featureKey)).toEqual(['decl2-mf:gen.pl', 'verb-thematic:aor.act.ind.3.sg'])
    expect(spots[0]).toMatchObject({ misses: 4, total: 5, unit: { id: 'decl2' }, lesson: { id: 'decl2.2' }, topic: 'decl2' })
    expect(spots[1]).toMatchObject({ unit: { id: 'aor-act' }, lesson: { id: 'aor-act.1' }, topic: 'aorist' })
  })
  it('leave out old answers and forms mostly right', () => {
    const old = day.getTime() - 40 * 24 * 3600 * 1000
    const attempts = [
      ...Array.from({ length: 5 }, () => answered('decl2-mf:gen.pl', false, old)),
      ...Array.from({ length: 3 }, () => answered('decl2-n:nom.pl', false)),
      ...Array.from({ length: 8 }, () => answered('decl2-n:nom.pl', true)),
    ]
    expect(weakSpots(attempts, now)).toEqual([])
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
