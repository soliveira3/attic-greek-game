import { describe, expect, it } from 'vitest'
import adjectives from '../../../data/paradigms/adjectives.json'
import nouns from '../../../data/paradigms/nouns.json'
import verbs from '../../../data/paradigms/verbs.json'
import { makeParadigms } from './data'
import type { ParadigmFile } from './features'
import { isComplete, nearestParse, parseGroups, selectionOf, selectionWords, skipped } from './parsing'

const data = makeParadigms([nouns, adjectives, verbs] as unknown as ParadigmFile[])
const logos = data.lemma('noun:λόγος')!
const agathos = data.lemma('adj:ἀγαθός')!
const article = data.lemma('article:ὁ')!
const lyo = data.lemma('verb:λύω')!

describe('parseGroups', () => {
  it('asks a noun for case and number, an adjective also for gender', () => {
    expect(parseGroups(logos, { dual: false }).map((g) => g.id)).toEqual(['case', 'number'])
    expect(parseGroups(agathos, { dual: false }).map((g) => g.id)).toEqual(['case', 'number', 'gender'])
    expect(parseGroups(lyo, { dual: false }).map((g) => g.id)).toEqual(['tense', 'voice', 'mood', 'person', 'number'])
  })
  it('offers only the values the word has, and the dual only when drilled', () => {
    expect(parseGroups(article, { dual: false })[0].options.map((o) => o.value)).not.toContain('voc')
    expect(parseGroups(logos, { dual: false })[0].options.map((o) => o.value)).toEqual(['nom', 'gen', 'dat', 'acc', 'voc'])
    expect(parseGroups(logos, { dual: false })[1].options.map((o) => o.value)).toEqual(['sg', 'pl'])
    expect(parseGroups(logos, { dual: true })[1].options.map((o) => o.value)).toEqual(['sg', 'du', 'pl'])
    expect(parseGroups(lyo, { dual: false })[1].options.map((o) => o.value)).toEqual(['act', 'mid', 'pass'])
    expect(parseGroups(logos, { dual: false })[0].options[1].label).toBe('genitive')
  })
})

describe('selections', () => {
  it('skips person and number for an infinitive', () => {
    expect(skipped('person', { mood: 'inf' })).toBe(true)
    expect(skipped('number', { mood: 'ind' })).toBe(false)
    expect(skipped('case', { mood: 'inf' })).toBe(false)
  })
  it('is complete when every group not skipped has a value', () => {
    const groups = parseGroups(lyo, { dual: false })
    expect(isComplete(groups, { tense: 'pres', voice: 'act', mood: 'inf' })).toBe(true)
    expect(isComplete(groups, { tense: 'pres', voice: 'act', mood: 'ind' })).toBe(false)
  })
  it('builds a parse selection, leaving out what the word does not have', () => {
    expect(selectionOf(logos, { case: 'gen', number: 'sg' })).toEqual({ case: 'gen', number: 'sg' })
    expect(selectionOf(agathos, { case: 'gen', number: 'sg', gender: 'f' })).toEqual({ case: 'gen', number: 'sg', gender: 'f' })
    expect(selectionOf(lyo, { tense: 'pres', voice: 'act', mood: 'inf', person: '1' })).toEqual({ tense: 'pres', voice: 'act', mood: 'inf' })
    expect(selectionOf(lyo, { tense: 'aor', voice: 'mid', mood: 'ind', person: '3', number: 'pl' })).toEqual({
      tense: 'aor',
      voice: 'mid',
      mood: 'ind',
      person: '3',
      number: 'pl',
    })
  })
  it('describes a selection in words', () => {
    expect(selectionWords({ case: 'gen', number: 'sg', gender: 'f' }).map((w) => w.text)).toEqual(['genitive', 'singular', 'feminine'])
    expect(selectionWords({ tense: 'aor', voice: 'mid', mood: 'ind', person: '3', number: 'pl' }).map((w) => w.text)).toEqual([
      'aorist',
      'middle',
      'indicative',
      '3rd person',
      'plural',
    ])
  })
})

describe('nearestParse', () => {
  it('finds the valid parse closest to the selection and what differs', () => {
    const parses = data.parsesOf(logos, data.forms(logos, 'gen.sg')[0])
    const n = nearestParse({ case: 'dat', number: 'sg' }, parses)
    expect(n.parse.key).toBe('gen.sg')
    expect([...n.wrong]).toEqual(['case'])
  })
  it('lets either voice match a shared middle/passive form', () => {
    const parses = data.parsesOf(lyo, data.forms(lyo, 'pres.mp.ind.1.sg')[0])
    const n = nearestParse({ tense: 'pres', voice: 'pass', mood: 'ind', person: '1', number: 'sg' }, parses)
    expect(n.wrong.size).toBe(0)
    const m = nearestParse({ tense: 'impf', voice: 'act', mood: 'ind', person: '1', number: 'sg' }, parses)
    expect([...m.wrong].sort()).toEqual(['tense', 'voice'])
  })
  it('counts every feature as wrong across kinds', () => {
    const parses = data.parsesOf(lyo, data.forms(lyo, 'pres.act.inf')[0])
    expect(nearestParse({ case: 'gen', number: 'sg' }, parses).wrong.size).toBeGreaterThan(0)
  })
})
