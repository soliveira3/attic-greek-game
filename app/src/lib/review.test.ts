import { describe, expect, it } from 'vitest'
import adjectives from '../../../data/paradigms/adjectives.json'
import nouns from '../../../data/paradigms/nouns.json'
import verbs from '../../../data/paradigms/verbs.json'
import { makeParadigms } from './data'
import type { ParadigmFile } from './features'
import { seededRng } from './prompts'
import { reviewQueue } from './review'
import { DEFAULT_SETTINGS, type Settings } from './settings'
import { EMPTY_SRS, Grade, type SrsState, review } from './srs'

const data = makeParadigms([nouns, adjectives, verbs] as unknown as ParadigmFile[])
const DAY = 24 * 60 * 60 * 1000
const t0 = new Date('2026-10-20T09:00:00')
const settings = (patch: Partial<Settings> = {}): Settings => ({ ...DEFAULT_SETTINGS, ...patch })

describe('reviewQueue', () => {
  it('starts with new items, the most frequent words first, one cell each, up to the daily limit', () => {
    const q = reviewQueue(data, settings(), EMPTY_SRS, t0, seededRng(1))
    expect(q).toHaveLength(20)
    expect(q.every((e) => e.isNew)).toBe(true)
    expect(new Set(q.map((e) => e.prompt.lemma)).size).toBe(20)
    const ranks = q.map((e) => e.prompt.lemma.rank ?? Infinity)
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b))
  })
  it('honours the scope and the daily limit', () => {
    const q = reviewQueue(data, settings({ newPerDay: 5, scope: { ...DEFAULT_SETTINGS.scope, pos: ['verb'], tenses: ['aor'] } }), EMPTY_SRS, t0, seededRng(2))
    expect(q).toHaveLength(5)
    expect(q.every((e) => e.prompt.lemma.pos === 'verb' && e.prompt.cell.key.startsWith('aor.'))).toBe(true)
  })
  it('puts due items first, earliest first, and leaves out items not yet due', () => {
    let srs: SrsState = EMPTY_SRS
    const first = reviewQueue(data, settings({ newPerDay: 3 }), srs, t0, seededRng(3))
    for (const e of first) srs = review(srs, e.prompt, Grade.Good, t0, { introduced: true })
    expect(reviewQueue(data, settings({ newPerDay: 3 }), srs, t0, seededRng(3))).toEqual([])
    const due = reviewQueue(data, settings({ newPerDay: 3 }), srs, new Date(t0.getTime() + 30 * DAY), seededRng(3))
    expect(due.slice(0, 3).map((e) => e.prompt.itemKey).sort()).toEqual(first.map((e) => e.prompt.itemKey).sort())
    expect(due.slice(0, 3).every((e) => !e.isNew)).toBe(true)
    expect(due.slice(3).every((e) => e.isNew)).toBe(true)
  })
  it('skips due items that are out of scope or no longer in the data', () => {
    let srs = review(EMPTY_SRS, { itemKey: 'noun:nonexistent|gen.sg', featureKey: 'decl2-mf:gen.sg' }, Grade.Good, t0)
    const verb = data.lemmasWhere({ pos: ['verb'] })[0]
    srs = review(srs, { itemKey: `verb:${verb.id}|${verb.cells[0].key}`, featureKey: `verb-thematic:${verb.cells[0].key}` }, Grade.Good, t0)
    const q = reviewQueue(data, settings({ newPerDay: 0, scope: { ...DEFAULT_SETTINGS.scope, pos: ['noun'] } }), srs, new Date(t0.getTime() + 30 * DAY), seededRng(4))
    expect(q).toEqual([])
  })
  it('a weak feature cell pulls in words of the same class not yet met in that cell', () => {
    const lemma = data.lemmasWhere({ classes: ['decl3-dental'] })[0]
    const feature = { itemKey: `noun:${lemma.id}|dat.pl`, featureKey: 'decl3-dental:dat.pl' }
    let srs = review(EMPTY_SRS, feature, Grade.Good, t0)
    srs = review(srs, feature, Grade.Again, new Date(t0.getTime() + 60_000))
    const q = reviewQueue(data, settings({ newPerDay: 2 }), srs, new Date(t0.getTime() + 120_000), seededRng(5))
    const fresh = q.filter((e) => e.isNew)
    expect(fresh[0].prompt.lemma.class).toBe('decl3-dental')
    expect(fresh[0].prompt.cell.key).toBe('dat.pl')
    expect(fresh[0].prompt.lemma.id).not.toBe(lemma.id)
  })
  it('counts the new cards already introduced today', () => {
    let srs: SrsState = EMPTY_SRS
    for (const e of reviewQueue(data, settings({ newPerDay: 4 }), srs, t0, seededRng(6)).slice(0, 3)) {
      srs = review(srs, e.prompt, Grade.Good, t0, { introduced: true })
    }
    expect(reviewQueue(data, settings({ newPerDay: 4 }), srs, t0, seededRng(6)).filter((e) => e.isNew)).toHaveLength(1)
    expect(reviewQueue(data, settings({ newPerDay: 4 }), srs, new Date(t0.getTime() + DAY), seededRng(6)).filter((e) => e.isNew)).toHaveLength(4)
  })
})
