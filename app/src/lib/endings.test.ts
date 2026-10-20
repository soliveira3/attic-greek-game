import { describe, expect, it } from 'vitest'
import { greekToBeta, betaToGreek } from './betacode'
import { checkEnding, goldenModels, setsInScope, sprintItems, sprintSets } from './endings'
import { DEFAULT_SETTINGS } from './settings'
import { stripAccents, stripAll } from './normalize'

const models = goldenModels()

describe('golden models', () => {
  it('one verified model per class, the article excepted', () => {
    expect(models.length).toBeGreaterThanOrEqual(22)
    expect(models.every((m) => m.verified)).toBe(true)
  })
})

describe('sprint sets', () => {
  const sets = sprintSets(models)
  it('every declension and adjective class, and every verb block of the models', () => {
    const classes = new Set(sets.map((s) => s.cls))
    expect(classes.has('decl2-mf') && classes.has('decl3-velar') && classes.has('adj-3-es')).toBe(true)
    expect(classes.has('article')).toBe(false)
    expect(sets.some((s) => s.block === 'aor.pass')).toBe(true)
  })
  it('each ending is the end of the model form, after the letters all forms share', () => {
    for (const set of sets) {
      for (const item of sprintItems(set)) {
        expect(item.endings.length).toBeGreaterThan(0)
        for (const e of item.endings) expect(e.length).toBeGreaterThan(0)
        expect(item.forms.some((f) => stripAll(f).endsWith(stripAll(item.endings[0])))).toBe(true)
        expect(stripAll(item.forms[0]).slice(0, set.stemLength)).toBe(set.stem)
      }
    }
  })
  it('3rd-declension consonant stems leave out nom./voc. sg. and dat. pl.', () => {
    const velar = sets.find((s) => s.cls === 'decl3-velar')!
    const cells = sprintItems(velar).map((i) => i.cell)
    expect(cells).not.toContain('nom.sg')
    expect(cells).not.toContain('voc.sg')
    expect(cells).not.toContain('dat.pl')
    expect(cells).toContain('gen.sg')
  })
  it('leaves out the dual unless asked', () => {
    const set = sets.find((s) => s.cls === 'decl2-mf')!
    expect(sprintItems(set).some((i) => i.cell.endsWith('.du'))).toBe(false)
    expect(sprintItems(set, { dual: true }).some((i) => i.cell.endsWith('.du'))).toBe(true)
  })
})

describe('checkEnding', () => {
  const set = sprintSets(models).find((s) => s.cls === 'decl2-mf')!
  const items = sprintItems(set)
  it('accepts the ending typed in beta code, accents ignored', () => {
    for (const item of items) {
      for (const e of item.endings) expect(checkEnding(betaToGreek(greekToBeta(stripAccents(e))), item)).toBe(true)
    }
  })
  it('rejects another cell’s different ending', () => {
    const [a, b] = items.filter((i, _, all) => all.every((j) => j === i || stripAll(j.endings[0]) !== stripAll(i.endings[0])))
    expect(checkEnding(a.endings[0], b)).toBe(false)
  })
})

describe('fused cells and extra model verbs', () => {
  const sets = sprintSets(models)
  it('a neuter consonant stem also leaves out the accusative singular (= nominative)', () => {
    const dental = sets.find((s) => s.cls === 'decl3-dental')!
    expect(sprintItems(dental).map((i) => i.cell)).not.toContain('acc.sg')
    expect(sprintItems(dental).find((i) => i.cell === 'gen.sg')!.endings).toEqual(
      sprintItems(sets.find((s) => s.cls === 'decl3-velar')!).find((i) => i.cell === 'gen.sg')!.endings,
    )
  })
  it('a second model verb only adds its own aorist', () => {
    const second = sets.filter((s) => s.block && s.lemma !== sets.find((x) => x.block)!.lemma)
    expect(second.length).toBeGreaterThan(0)
    expect(second.every((s) => s.block!.startsWith('aor.'))).toBe(true)
  })
})

describe('shown stem and scope', () => {
  const sets = sprintSets(models)
  it('shows the stem with its breathing, without accents', () => {
    for (const set of sets) {
      expect(stripAll(set.stemShown)).toBe(set.stem)
      expect(stripAccents(set.stemShown)).toBe(set.stemShown)
    }
  })
  it('lists nominal sets in class order, then the verb blocks; a second model verb is named', () => {
    const nominal = sets.filter((s) => !s.block).map((s) => s.cls)
    expect(nominal.indexOf('decl1-a-long')).toBeLessThan(nominal.indexOf('decl2-mf'))
    expect(nominal.indexOf('decl3-eu')).toBeLessThan(nominal.indexOf('adj-212-eta'))
    expect(sets.findIndex((s) => s.block)).toBe(nominal.length)
    const verbLemmas = [...new Set(sets.filter((s) => s.block).map((s) => s.lemma))]
    expect(sets.filter((s) => s.lemma === verbLemmas[1]).every((s) => s.label.includes(verbLemmas[1]))).toBe(true)
  })
  it('keeps the sets the scope settings allow', () => {
    const all = DEFAULT_SETTINGS.scope
    expect(setsInScope(sets, all)).toEqual(sets)
    expect(setsInScope(sets, { ...all, pos: ['verb'] }).every((s) => s.block)).toBe(true)
    expect(setsInScope(sets, { ...all, classes: ['decl2-n'] }).map((s) => s.cls)).toEqual(['decl2-n'])
    const aorists = setsInScope(sets, { ...all, pos: ['verb'], tenses: ['aor'], voices: ['pass'] })
    expect(aorists.map((s) => s.block)).toEqual(['aor.pass'])
    expect(setsInScope(sets, { ...all, pos: ['adj'] }).every((s) => s.cls.startsWith('adj'))).toBe(true)
  })
})
