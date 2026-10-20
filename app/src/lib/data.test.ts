import { describe, expect, it } from 'vitest'
import adjectives from '../../../data/paradigms/adjectives.json'
import nouns from '../../../data/paradigms/nouns.json'
import verbs from '../../../data/paradigms/verbs.json'
import { type Paradigms, loadParadigms, makeParadigms, stemLength } from './data'
import type { ParadigmFile, VerbLemma } from './features'
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

describe('checkContext', () => {
  it('lists the forms of every other cell of the lemma', () => {
    const c = data.checkContext(lyo, 'fut.act.ind.1.sg')
    expect(c.otherForms.map((o) => o.cell)).not.toContain('fut.act.ind.1.sg')
    expect(c.otherForms.map((o) => o.cell)).toContain('pres.act.ind.1.sg')
  })
  it('knows which prompts are augmented tenses', () => {
    expect(data.checkContext(lyo, 'impf.act.ind.1.sg').pastTense).toBe(true)
    expect(data.checkContext(lyo, 'aor.pass.ind.3.pl').pastTense).toBe(true)
    expect(data.checkContext(lyo, 'aor.act.inf').pastTense).toBe(false)
    expect(data.checkContext(lyo, 'pres.act.ind.1.sg').pastTense).toBe(false)
    expect(data.checkContext(doron, 'gen.sg').pastTense).toBe(false)
  })
  it('finds the augment after the preverb of a compound', () => {
    expect(data.checkContext(lyo, 'impf.act.ind.1.sg').augmentAt).toBe(0)
    expect(data.checkContext(data.lemma('verb:ἔχω')!, 'impf.act.ind.1.sg').augmentAt).toBe(0)
    expect(data.checkContext(data.lemma('verb:ἀποκτείνω')!, 'impf.act.ind.1.sg').augmentAt).toBeGreaterThan(1)
    expect(data.checkContext(doron, 'gen.sg').augmentAt).toBeUndefined()
  })
  it('measures stems per mood: an aorist stem ignores the unaugmented infinitive', () => {
    for (const verb of data.lemmasWhere({ pos: ['verb'] })) {
      if (!data.forms(verb, 'aor.act.ind.1.sg').length) continue
      expect(data.checkContext(verb, 'aor.act.ind.1.sg').stemLength, verb.lemma).toBeGreaterThanOrEqual(2)
    }
  })
  it('measures 3rd-declension stems without the nominative singular and dative plural', () => {
    const phylax = data.lemma('noun:φύλαξ')!
    const all = stemLength(phylax.cells.flatMap((c) => c.forms))
    expect(data.checkContext(phylax, 'gen.sg').stemLength).toBeGreaterThan(all)
  })
  it('gives infinitives a stem too', () => {
    expect(data.checkContext(lyo, 'aor.pass.inf').stemLength).toBeGreaterThan(0)
    expect(data.checkContext(lyo, 'pres.act.inf').stemLength).toBeGreaterThan(0)
  })
})

describe('checkContext edge cases', () => {
  it('a verb with no past forms has its augment at the start', () => {
    const verb = lyo as VerbLemma
    const noPast: VerbLemma = { ...verb, cells: verb.cells.filter((c) => !/^(impf|aor)/.test(c.key)) }
    expect(data.checkContext(noPast, 'pres.act.ind.1.sg').augmentAt).toBe(0)
  })
})

describe('augment position', () => {
  it.each([
    ['λύω', 0],
    ['ἔχω', 0],
    ['ἥκω', 0],
    ['διώκω', 0],
    ['ἀποκτείνω', 2],
    ['παρέχω', 3],
    ['συμβαίνω', 3],
    ['προσήκω', 4],
  ])('%s', (lemma, at) => {
    expect(data.checkContext(data.lemma(`verb:${lemma}`)!, 'impf.act.ind.1.sg').augmentAt).toBe(at)
  })
})

describe('checkContext scope', () => {
  it('leaves out-of-scope cells (the dual by default) out of the other forms', () => {
    expect(data.checkContext(doron, 'gen.sg').otherForms.some((o) => o.cell.endsWith('.du'))).toBe(false)
    expect(data.checkContext(doron, 'gen.sg', { dual: true }).otherForms.some((o) => o.cell.endsWith('.du'))).toBe(true)
  })
})
