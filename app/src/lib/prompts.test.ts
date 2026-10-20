import { describe, expect, it } from 'vitest'
import adjectives from '../../../data/paradigms/adjectives.json'
import nouns from '../../../data/paradigms/nouns.json'
import verbs from '../../../data/paradigms/verbs.json'
import { type Paradigms, lemmaRef, makeParadigms } from './data'
import type { ParadigmFile } from './features'
import { key, sameSpelling } from './normalize'
import {
  DIFFICULTIES,
  blankCount,
  lemmasInScope,
  makePrompt,
  parsePrompt,
  pickCell,
  seededRng,
  tablePrompt,
} from './prompts'
import { DEFAULT_SETTINGS, type Settings } from './settings'

const data: Paradigms = makeParadigms([nouns, adjectives, verbs] as unknown as ParadigmFile[])
const SEEDS = Array.from({ length: 150 }, (_, i) => i + 1)

function settings(scope: Partial<Settings['scope']> = {}): Settings {
  return { ...DEFAULT_SETTINGS, scope: { ...DEFAULT_SETTINGS.scope, ...scope } }
}

describe('seededRng', () => {
  it('repeats its sequence for a seed and stays in [0, 1)', () => {
    const a = seededRng(42)
    const b = seededRng(42)
    const xs = Array.from({ length: 50 }, () => a())
    expect(xs).toEqual(Array.from({ length: 50 }, () => b()))
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true)
    expect(seededRng(43)()).not.toBe(xs[0])
  })
})

describe('lemmasInScope', () => {
  it('keeps the chosen parts of speech and classes', () => {
    expect(lemmasInScope(data, settings({ pos: ['verb'] })).every((l) => l.pos === 'verb')).toBe(true)
    const only = lemmasInScope(data, settings({ classes: ['decl2-n', 'adj-22'] }))
    expect(new Set(only.map((l) => l.class))).toEqual(new Set(['decl2-n', 'adj-22']))
  })
  it('treats an empty class list as every class', () => {
    expect(lemmasInScope(data, settings()).length).toBe(data.lemmas.length)
  })
  it('drops verbs with nothing in the chosen tenses and voices', () => {
    const passives = lemmasInScope(data, settings({ pos: ['verb'], tenses: ['aor'], voices: ['pass'] }))
    expect(passives.length).toBeGreaterThan(0)
    expect(passives.length).toBeLessThan(lemmasInScope(data, settings({ pos: ['verb'] })).length)
    expect(lemmasInScope(data, settings({ pos: ['verb'], tenses: [] }))).toEqual([])
  })
})

describe('pickCell', () => {
  it('returns null when nothing is in scope', () => {
    expect(pickCell(data, settings({ pos: [] }), seededRng(1))).toBeNull()
  })
  it('only picks cells in scope', () => {
    const s = settings({ pos: ['verb', 'noun'], tenses: ['aor', 'fut'], voices: ['mid'] })
    for (const seed of SEEDS) {
      const { lemma, cell } = pickCell(data, s, seededRng(seed))!
      expect(cell.number).not.toBe('du')
      if ('tense' in cell) {
        expect(['aor', 'fut']).toContain(cell.tense)
        expect(cell.key.split('.')[1]).toBe('mid')
      } else expect(lemma.pos).toBe('noun')
    }
  })
  it('picks dual cells only when the dual is drilled', () => {
    const picks = SEEDS.map((seed) => pickCell(data, settings({ pos: ['noun'], dual: true }), seededRng(seed))!)
    expect(picks.some((p) => p.cell.number === 'du')).toBe(true)
  })
  it('is reproducible for a seed', () => {
    expect(pickCell(data, settings(), seededRng(7))!.cell.key).toBe(pickCell(data, settings(), seededRng(7))!.cell.key)
  })
  it('avoids the item just asked when there is another', () => {
    for (const seed of SEEDS.slice(0, 30)) {
      const first = makePrompt(data, settings({ classes: ['article'] }), seededRng(seed))!
      const next = makePrompt(data, settings({ classes: ['article'] }), seededRng(seed), first.itemKey)!
      expect(next.itemKey).not.toBe(first.itemKey)
    }
  })
})

describe('makePrompt', () => {
  it('carries the forms, the check context and the attempt keys', () => {
    for (const seed of SEEDS) {
      const p = makePrompt(data, settings(), seededRng(seed))!
      expect(p.forms).toEqual(data.forms(p.lemma, p.cell.key))
      expect(p.context).toEqual(data.checkContext(p.lemma, p.cell.key, { dual: false }))
      expect(p.itemKey).toBe(`${lemmaRef(p.lemma)}|${p.cell.key}`)
      expect(p.featureKey).toBe(`${p.lemma.class}:${p.cell.key}`)
      expect(p.label.length).toBeGreaterThan(0)
    }
  })
  it('returns null when nothing is in scope', () => {
    expect(makePrompt(data, settings({ pos: [] }), seededRng(1))).toBeNull()
  })
})

describe('parsePrompt', () => {
  it('shows one form of the cell and lists every parse of it', () => {
    for (const seed of SEEDS) {
      const p = parsePrompt(data, settings(), seededRng(seed))!
      expect(p.cell.forms.map(key)).toContain(key(p.form))
      expect(p.parses.map((c) => c.key)).toContain(p.cell.key)
      expect(p.parses.every((c) => c.forms.some((f) => key(f) === key(p.form)))).toBe(true)
      expect(p.parses.every((c) => c.number !== 'du')).toBe(true)
    }
  })
  it('with length marks shown, lists only parses that agree on vowel length', () => {
    const adj = settings({ pos: ['adj'] })
    let split = 0
    for (const seed of Array.from({ length: 600 }, (_, i) => i + 1)) {
      const p = parsePrompt(data, adj, seededRng(seed))!
      expect(p.parses.every((c) => c.forms.some((f) => sameSpelling(f, p.form)))).toBe(true)
      const homographs = data.parsesOf(p.lemma, p.form).filter((c) => c.number !== 'du')
      if (homographs.length > p.parses.length) {
        split++
        const plain = parsePrompt(data, { ...adj, lengthMarks: false }, seededRng(seed))!
        expect(plain.parses.map((c) => c.key)).toEqual(homographs.map((c) => c.key))
      }
    }
    expect(split).toBeGreaterThan(0)
  })
  it('lists dual parses when the dual is drilled', () => {
    const duals = SEEDS.map((seed) => parsePrompt(data, settings({ pos: ['noun'], dual: true }), seededRng(seed))!)
    expect(duals.some((p) => p.parses.some((c) => c.number === 'du'))).toBe(true)
  })
  it('returns null when nothing is in scope', () => {
    expect(parsePrompt(data, settings({ pos: [] }), seededRng(1))).toBeNull()
  })
})

describe('tablePrompt', () => {
  it('blanks a few, half or all of the cells', () => {
    expect(DIFFICULTIES).toEqual(['few', 'half', 'all'])
    expect([blankCount(10, 'few'), blankCount(10, 'half'), blankCount(10, 'all')]).toEqual([3, 5, 10])
    expect([blankCount(2, 'few'), blankCount(3, 'half')]).toEqual([2, 2])
  })
  it('gives a whole nominal paradigm in scope', () => {
    for (const seed of SEEDS.slice(0, 40)) {
      const t = tablePrompt(data, settings({ pos: ['noun', 'adj', 'article'] }), seededRng(seed), 'half')!
      expect(t.block).toBeNull()
      expect(t.cells.map((c) => c.key)).toEqual(data.cellsInScope(t.lemma, { dual: false }).map((c) => c.key))
      expect(t.blanks.size).toBe(blankCount(t.cells.length, 'half'))
      expect([...t.blanks].every((k) => t.cells.some((c) => c.key === k))).toBe(true)
    }
  })
  it('gives one tense-voice block of a verb, infinitive included, in scope', () => {
    const s = settings({ pos: ['verb'], tenses: ['aor', 'perf'] })
    for (const seed of SEEDS.slice(0, 40)) {
      const t = tablePrompt(data, s, seededRng(seed), 'all')!
      expect(['aor', 'perf']).toContain(t.block!.split('.')[0])
      expect(t.cells.every((c) => c.key.startsWith(`${t.block}.`))).toBe(true)
      expect(t.cells.some((c) => c.key.endsWith('.ind.1.sg') || c.key.endsWith('.ind.3.sg'))).toBe(true)
      expect(t.blanks.size).toBe(t.cells.length)
      expect(t.contexts[t.cells[0].key]).toEqual(data.checkContext(t.lemma, t.cells[0].key, { dual: false }))
    }
  })
  it('returns null when nothing is in scope', () => {
    expect(tablePrompt(data, settings({ pos: [] }), seededRng(1), 'few')).toBeNull()
  })
})
