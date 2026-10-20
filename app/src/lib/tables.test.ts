import { describe, expect, it } from 'vitest'
import adjectives from '../../../data/paradigms/adjectives.json'
import nouns from '../../../data/paradigms/nouns.json'
import verbs from '../../../data/paradigms/verbs.json'
import { makeParadigms } from './data'
import type { ParadigmFile } from './features'
import { tableLayout } from './tables'

const data = makeParadigms([nouns, adjectives, verbs] as unknown as ParadigmFile[])
const logos = data.lemma('noun:λόγος')!
const agathos = data.lemma('adj:ἀγαθός')!
const article = data.lemma('article:ὁ')!
const lyo = data.lemma('verb:λύω')!

const keys = (layout: ReturnType<typeof tableLayout>) => layout.sections.flatMap((s) => s.rows.flatMap((r) => r.keys))

describe('tableLayout', () => {
  it('lays a noun out as cases by numbers', () => {
    const t = tableLayout(logos, data.cellsInScope(logos, { dual: false }))
    expect(t.sections).toHaveLength(1)
    expect(t.sections[0].columns).toEqual(['singular', 'plural'])
    expect(t.sections[0].rows.map((r) => r.label)).toEqual(['nominative', 'genitive', 'dative', 'accusative', 'vocative'])
    expect(t.sections[0].rows[1].keys).toEqual(['gen.sg', 'gen.pl'])
  })
  it('adds the dual column when the dual is drilled', () => {
    const t = tableLayout(logos, data.cellsInScope(logos, { dual: true }))
    expect(t.sections[0].columns).toEqual(['singular', 'dual', 'plural'])
  })
  it('lays an adjective out by number, then cases by genders', () => {
    const t = tableLayout(agathos, data.cellsInScope(agathos, { dual: false }))
    expect(t.sections.map((s) => s.title)).toEqual(['singular', 'plural'])
    expect(t.sections[0].columns).toEqual(['masculine', 'feminine', 'neuter'])
    expect(t.sections[1].rows[0].keys).toEqual(['nom.pl.m', 'nom.pl.f', 'nom.pl.n'])
  })
  it('leaves out the cases a word lacks (the article has no vocative)', () => {
    const t = tableLayout(article, data.cellsInScope(article, { dual: false }))
    expect(t.sections[0].rows.map((r) => r.label)).not.toContain('vocative')
  })
  it('lays a verb block out by person and number, the infinitive last', () => {
    const cells = data.cellsInScope(lyo, { dual: false }).filter((c) => c.key.startsWith('aor.mid.'))
    const t = tableLayout(lyo, cells)
    expect(t.sections).toHaveLength(1)
    expect(t.sections[0].rows.map((r) => r.label)).toEqual(['1st sg.', '2nd sg.', '3rd sg.', '1st pl.', '2nd pl.', '3rd pl.', 'infinitive'])
    expect(t.sections[0].rows[0].keys).toEqual(['aor.mid.ind.1.sg'])
    expect(t.sections[0].rows[6].keys).toEqual(['aor.mid.inf'])
  })
  it('places every cell exactly once and marks missing ones null', () => {
    for (const lemma of [logos, agathos, article, lyo]) {
      const cells = data.cellsInScope(lemma, { dual: true }).filter((c) => !('tense' in c) || c.key.startsWith('perf.mp.'))
      const placed = keys(tableLayout(lemma, cells)).filter((k): k is string => k !== null)
      expect(placed.sort()).toEqual(cells.map((c) => c.key).sort())
    }
    const partial = data.cellsInScope(logos, { dual: false }).filter((c) => c.key !== 'voc.pl')
    expect(tableLayout(logos, partial).sections[0].rows[4].keys).toEqual(['voc.sg', null])
  })
})
