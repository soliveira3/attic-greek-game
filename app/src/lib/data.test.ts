import { describe, expect, it } from 'vitest'
import adjectives from '../../../data/paradigms/adjectives.json'
import nouns from '../../../data/paradigms/nouns.json'
import verbs from '../../../data/paradigms/verbs.json'
import { type Paradigms, loadParadigms, makeParadigms, stemLength } from './data'
import type { ParadigmFile } from './features'
import { key } from './normalize'

const files = [nouns, adjectives, verbs] as unknown as ParadigmFile[]
const data: Paradigms = makeParadigms(files)
const doron = data.lemma('noun:δῶρον')!
const lyo = data.lemma('verb:λύω')!

describe('makeParadigms', () => {
  it('indexes every lemma of every file', () => {
    expect(data.lemmas.length).toBe(files.reduce((n, f) => n + f.lemmas.length, 0))
    expect(data.lemma('adj:ὁ')).toBeUndefined()
    expect(data.lemma('article:ὁ')?.class).toBe('article')
  })
  it('filters by part of speech and class', () => {
    expect(data.lemmasWhere({ pos: ['verb'] }).every((l) => l.pos === 'verb')).toBe(true)
    expect(data.lemmasWhere({ classes: ['decl2-n'] }).map((l) => l.class)).toContain('decl2-n')
  })
})

describe('cells and parses', () => {
  it('returns the forms of a cell, or none', () => {
    expect(data.forms(doron, 'gen.sg').length).toBeGreaterThan(0)
    expect(data.forms(doron, 'gen.sg.m')).toEqual([])
  })
  it('lists every parse of a syncretic form (neuter nom. = acc. = voc.)', () => {
    const form = data.forms(doron, 'nom.sg')[0]
    const parses = data.parsesOf(doron, form).map((c) => c.key)
    expect(parses).toEqual(expect.arrayContaining(['nom.sg', 'acc.sg', 'voc.sg']))
  })
  it('matches forms regardless of length marks and Unicode composition', () => {
    const form = data.forms(lyo, 'pres.act.ind.1.sg')[0]
    expect(data.parsesOf(lyo, key(form).normalize('NFD')).map((c) => c.key)).toContain('pres.act.ind.1.sg')
  })
})

describe('verb blocks and scope', () => {
  it('groups verb cells into tense-voice blocks', () => {
    expect(data.blocks(lyo)).toEqual(expect.arrayContaining(['pres.act', 'pres.mp', 'aor.pass']))
    expect(data.blocks(doron)).toEqual([])
  })
  it('leaves the dual out unless asked', () => {
    const keys = data.cellsInScope(doron, {}).map((c) => c.key)
    expect(keys.some((k) => k.endsWith('.du'))).toBe(false)
    expect(data.cellsInScope(doron, { dual: true }).some((c) => c.key.endsWith('.du'))).toBe(true)
  })
  it('limits verbs by tense, voice and mood', () => {
    const cells = data.cellsInScope(lyo, { tenses: ['aor'], voices: ['pass'], moods: ['ind'] })
    expect(cells.length).toBe(6)
    expect(cells.every((c) => c.key.startsWith('aor.pass.ind.'))).toBe(true)
  })
})

describe('stemLength', () => {
  it('counts the letters every form shares', () => {
    const block = data.cellsInScope(lyo, { tenses: ['pres'], voices: ['act'], moods: ['ind'] }).flatMap((c) => c.forms)
    expect(stemLength(block)).toBeGreaterThan(0)
    expect(stemLength([])).toBe(0)
  })
})

describe('loadParadigms', () => {
  it('loads the three files', async () => {
    const loaded = await loadParadigms()
    expect(loaded.lemmas.length).toBe(data.lemmas.length)
  })
})
