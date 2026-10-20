import { describe, expect, it } from 'vitest'
import schema from '../../../pipeline/schema.json'
import {
  ADJ_CLASSES,
  AORIST_TYPES,
  CASES,
  GENDERS,
  MOODS,
  NOUN_CLASSES,
  NUMBERS,
  PERSONS,
  POS,
  TENSES,
  VERB_CLASSES,
  VOICE_GROUPS,
  VOICES,
} from './features'

const defs = schema.$defs

describe('features.ts mirrors pipeline/schema.json', () => {
  it.each([
    ['pos', POS, defs.pos.enum],
    ['case', CASES, defs.case.enum],
    ['number', NUMBERS, defs.number.enum],
    ['gender', GENDERS, defs.gender.enum],
    ['tense', TENSES, defs.tense.enum],
    ['voice', VOICES, defs.voice.enum],
    ['voiceGroup', VOICE_GROUPS, defs.voiceGroup.enum],
    ['mood', MOODS, defs.mood.enum],
    ['person', PERSONS, defs.person.enum],
    ['aoristType', AORIST_TYPES, defs.aoristType.enum],
    ['nounClass', NOUN_CLASSES, defs.nounClass.enum],
    ['adjClass', ADJ_CLASSES, defs.adjClass.enum],
    ['verbClass', VERB_CLASSES, defs.verbClass.enum],
  ])('%s', (_name, ts, json) => {
    expect([...ts]).toEqual(json)
  })
})

import adjectives from '../../../data/paradigms/adjectives.json'
import nouns from '../../../data/paradigms/nouns.json'
import verbs from '../../../data/paradigms/verbs.json'
import {
  ADJ_CLASSES as ADJ,
  CLASS_FAMILIES,
  NOUN_CLASSES as NOUN,
  blockLabel,
  cellKey,
  cellLabel,
  classLabel,
  compareCellKeys,
  featureKey,
  parseFeatureKey,
  parseCellKey,
} from './features'

const allCells = [...nouns.lemmas, ...adjectives.lemmas, ...verbs.lemmas].flatMap((l) =>
  l.cells.map((c) => ({ ...c, cls: l.class })),
)

describe('cell keys', () => {
  it('parse back to the features stored with every cell in the data', () => {
    for (const c of allCells) {
      const { key, forms: _forms, cls: _cls, ...features } = c
      expect(parseCellKey(key)).toEqual(features)
      expect(cellKey(parseCellKey(key))).toBe(key)
    }
  })
  it('reject malformed keys', () => {
    expect(() => parseCellKey('gen')).toThrow()
    expect(() => parseCellKey('pres.xx.ind.1.sg')).toThrow()
  })
  it('sort in paradigm order', () => {
    expect(['gen.pl', 'nom.sg', 'dat.sg', 'nom.pl'].sort(compareCellKeys)).toEqual(['nom.sg', 'dat.sg', 'nom.pl', 'gen.pl'])
    expect(['pres.act.inf', 'pres.act.ind.1.pl', 'pres.act.ind.3.sg'].sort(compareCellKeys)).toEqual([
      'pres.act.ind.3.sg', 'pres.act.ind.1.pl', 'pres.act.inf',
    ])
  })
})

describe('labels', () => {
  it('name cells in plain English', () => {
    expect(cellLabel('gen.pl')).toBe('genitive plural')
    expect(cellLabel('gen.pl.f')).toBe('genitive plural feminine')
    expect(cellLabel('aor.mid.ind.3.pl')).toBe('aorist middle indicative, 3rd person plural')
    expect(cellLabel('pres.mp.inf')).toBe('present middle/passive infinitive')
    expect(cellLabel('gen.pl', { short: true })).toBe('gen. pl.')
    expect(cellLabel('aor.mid.ind.3.pl', { short: true })).toBe('aor. mid. 3 pl.')
  })
  it('name every class and block', () => {
    for (const c of [...NOUN, ...ADJ, 'article', 'verb-thematic'] as const) expect(classLabel(c)).toMatch(/\w/)
    expect(blockLabel('aor.pass')).toBe('aorist passive')
  })
  it('group every class into a family', () => {
    const grouped = Object.values(CLASS_FAMILIES).flat()
    expect(new Set(grouped)).toEqual(new Set([...NOUN, ...ADJ, 'article', 'verb-thematic']))
  })
})

describe('feature keys (the unit of review)', () => {
  it('combine class and cell and parse back', () => {
    const k = featureKey('decl1-eta', 'gen.pl')
    expect(parseFeatureKey(k)).toEqual({ cls: 'decl1-eta', cell: 'gen.pl' })
  })
})

describe('cell keys, edge cases', () => {
  it('rejects extra or unknown parts', () => {
    expect(() => parseCellKey('pres.act.inf.1')).toThrow()
    expect(() => parseCellKey('gen.sg.x')).toThrow()
    expect(() => blockLabel('pres.xx')).toThrow()
  })
  it('compares a key with itself as equal', () => {
    expect(compareCellKeys('gen.pl.f', 'gen.pl.f')).toBe(0)
  })
})

describe('ordering mixed keys', () => {
  it('orders a noun key and a verb key consistently', () => {
    expect(Math.sign(compareCellKeys('gen.sg', 'pres.act.inf'))).toBe(-Math.sign(compareCellKeys('pres.act.inf', 'gen.sg')))
    expect(compareCellKeys('gen.sg', 'pres.act.inf')).not.toBe(0)
  })
})
