import { describe, expect, it } from 'vitest'
import adjectives from '../../../data/paradigms/adjectives.json'
import nouns from '../../../data/paradigms/nouns.json'
import verbs from '../../../data/paradigms/verbs.json'
import type { Attempt } from './attempts'
import { makeParadigms } from './data'
import type { ParadigmFile } from './features'
import { EMPTY_SRS, Grade, review } from './srs'
import { accuracyByFeature, dueToday, heatLayout, streak } from './stats'

const data = makeParadigms([nouns, adjectives, verbs] as unknown as ParadigmFile[])
const at = (s: string) => new Date(s).getTime()
const attempt = (ts: number, correct = true, featureKey = 'decl2-mf:gen.sg'): Attempt => ({
  itemKey: 'noun:x|gen.sg',
  featureKey,
  correct,
  errorKind: correct ? null : 'ending',
  ts,
  mode: 'make',
})

describe('streak', () => {
  it('counts consecutive days with answers, back from today', () => {
    const now = new Date('2026-10-20T20:00:00')
    expect(streak([], now)).toBe(0)
    const days = ['2026-10-17T10:00:00', '2026-10-18T23:00:00', '2026-10-19T08:00:00', '2026-10-20T07:00:00', '2026-10-20T09:00:00']
    expect(streak(days.map((d) => attempt(at(d))), now)).toBe(4)
    expect(streak([attempt(at('2026-10-15T10:00:00')), attempt(at('2026-10-20T10:00:00'))], now)).toBe(1)
  })
  it('keeps yesterday’s streak alive until the day is over', () => {
    const now = new Date('2026-10-20T08:00:00')
    expect(streak([attempt(at('2026-10-18T10:00:00')), attempt(at('2026-10-19T10:00:00'))], now)).toBe(2)
    expect(streak([attempt(at('2026-10-18T10:00:00'))], now)).toBe(0)
  })
})

describe('accuracyByFeature', () => {
  it('counts right answers per feature cell', () => {
    const a = accuracyByFeature([attempt(1), attempt(2, false), attempt(3, true, 'decl2-mf:dat.pl')])
    expect(a.get('decl2-mf:gen.sg')).toEqual({ right: 1, total: 2 })
    expect(a.get('decl2-mf:dat.pl')).toEqual({ right: 1, total: 1 })
  })
})

describe('dueToday', () => {
  it('counts item cards due by the end of the local day', () => {
    const t0 = new Date('2026-10-20T09:00:00')
    const s = review(EMPTY_SRS, { itemKey: 'a', featureKey: 'f' }, Grade.Again, t0)
    expect(dueToday(s, t0)).toBe(1)
    expect(dueToday(review(s, { itemKey: 'b', featureKey: 'f' }, Grade.Good, t0), new Date('2026-10-20T09:00:00'))).toBeGreaterThanOrEqual(1)
    expect(dueToday(EMPTY_SRS, t0)).toBe(0)
  })
})

describe('heatLayout', () => {
  it('lays a nominal class out like its first word', () => {
    const t = heatLayout('decl2-mf', data, false)
    expect(t.sections[0].rows[1].keys).toEqual(['gen.sg', 'gen.pl'])
    expect(heatLayout('adj-212-eta', data, false).sections.map((s) => s.title)).toEqual(['singular', 'plural'])
  })
  it('lays verbs out as tense-voice rows by person and number', () => {
    const t = heatLayout('verb-thematic', data, false)
    const s = t.sections[0]
    expect(s.rows.slice(0, 2).map((r) => r.label)).toEqual(['present active', 'present middle/passive'])
    expect(s.columns).toEqual(['1st sg.', '2nd sg.', '3rd sg.', '1st pl.', '2nd pl.', '3rd pl.', 'inf.'])
    expect(s.rows[0].keys[0]).toBe('pres.act.ind.1.sg')
    expect(s.rows[0].keys[6]).toBe('pres.act.inf')
    expect(s.rows.every((r) => r.keys.length === s.columns.length)).toBe(true)
  })

})
