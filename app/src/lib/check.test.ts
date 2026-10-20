import { describe, expect, it } from 'vitest'
import adjectives from '../../../data/paradigms/adjectives.json'
import nouns from '../../../data/paradigms/nouns.json'
import verbs from '../../../data/paradigms/verbs.json'
import { betaToGreek, greekToBeta } from './betacode'
import { type Strictness, STRICTNESS, checkAnswer, checkParse } from './check'
import { makeParadigms, stemLength } from './data'
import { type ParadigmFile, parseCellKey } from './features'
import { IOTA_SUBSCRIPT, ROUGH, SMOOTH, key, nfc, stripAccents } from './normalize'

const data = makeParadigms([nouns, adjectives, verbs] as unknown as ParadigmFile[])
const golden = import.meta.glob<{ lemma: string; pos: string; verified: boolean; cells: Record<string, string[]> }>(
  '../../../data/golden/*.json',
  { eager: true, import: 'default' },
)
const verified = Object.values(golden).filter((g) => g.verified)

const swap = (s: string, from: string, to: string) => nfc(s.normalize('NFD').split(from).join(to))
const drop = (s: string, mark: string) => swap(s, mark, '')

describe('every verified golden form passes in every mode', () => {
  it('has verified golden files to test', () => expect(verified.length).toBeGreaterThan(20))
  it.each(verified.map((g) => [g.lemma, g] as const))('%s', (_lemma, g) => {
    for (const forms of Object.values(g.cells)) {
      for (const form of forms) {
        for (const mode of STRICTNESS) {
          const r = checkAnswer(form, forms, mode)
          expect(r.correct && r.exact, `${form} in ${mode}`).toBe(true)
          expect(r.errorKind).toBeNull()
          expect(r.notes).toEqual([])
        }
        // typed in beta code, without length marks
        expect(checkAnswer(betaToGreek(greekToBeta(form)), forms, 'strict').exact).toBe(true)
      }
    }
  })
})

const logos = data.lemma('noun:λόγος')!
const lyo = data.lemma('verb:λύω')!
const goldenForms = verified.flatMap((g) => Object.values(g.cells).flat())

function expectKinds(answer: string, forms: string[], expected: Record<Strictness, [boolean, string | null, string[]]>, opts = {}) {
  for (const mode of STRICTNESS) {
    const r = checkAnswer(answer, forms, mode, opts)
    expect([r.correct, r.errorKind, r.notes], `${answer} in ${mode}`).toEqual(expected[mode])
  }
}

describe('diacritic errors', () => {
  it('a missing accent is wrong only in strict mode', () => {
    const form = data.forms(logos, 'gen.sg')[0]
    expectKinds(stripAccents(form), [form], {
      strict: [false, 'accent', []],
      'ignore-accents': [true, null, ['accent']],
      lenient: [true, null, ['accent']],
    })
  })
  it('a wrong breathing is wrong unless lenient', () => {
    const form = goldenForms.find((f) => f.normalize('NFD').includes(ROUGH))!
    expectKinds(swap(form, ROUGH, SMOOTH), [form], {
      strict: [false, 'breathing', []],
      'ignore-accents': [false, 'breathing', []],
      lenient: [true, null, ['breathing']],
    })
  })
  it('a missing iota subscript is wrong unless lenient', () => {
    const form = data.forms(logos, 'dat.sg')[0]
    expect(form.normalize('NFD')).toContain(IOTA_SUBSCRIPT)
    expectKinds(drop(form, IOTA_SUBSCRIPT), [form], {
      strict: [false, 'subscript', []],
      'ignore-accents': [false, 'subscript', []],
      lenient: [true, null, ['subscript']],
    })
  })
})

describe('letter errors', () => {
  it('the wrong ending is an ending error, whatever the mode', () => {
    const block = ['nom.sg', 'gen.sg', 'dat.sg', 'acc.sg'].flatMap((k) => data.forms(logos, k))
    const opts = { stemLength: stemLength(block) }
    for (const mode of STRICTNESS) {
      const r = checkAnswer(data.forms(logos, 'gen.sg')[0], data.forms(logos, 'dat.sg'), mode, opts)
      expect([r.correct, r.errorKind]).toEqual([false, 'ending'])
    }
  })
  it('the right ending on the wrong stem is a stem error', () => {
    const doron = data.lemma('noun:δῶρον')!
    const block = ['nom.sg', 'gen.sg', 'dat.sg'].flatMap((k) => data.forms(logos, k))
    const r = checkAnswer(data.forms(doron, 'gen.sg')[0], data.forms(logos, 'gen.sg'), 'lenient', {
      stemLength: stemLength(block),
    })
    expect([r.correct, r.errorKind]).toEqual([false, 'stem'])
  })
  it('a missing augment is an augment error', () => {
    const impf = data.forms(lyo, 'impf.act.ind.1.sg')[0]
    const unaugmented = stripAccents(key(impf)).slice(1)
    const r = checkAnswer(unaugmented, [impf], 'lenient', { pastTense: true, stemLength: 2 })
    expect([r.correct, r.errorKind]).toEqual([false, 'augment'])
  })
  it('a blank answer is a blank error', () => {
    expect(checkAnswer('  ', data.forms(logos, 'gen.sg'), 'lenient').errorKind).toBe('blank')
  })
})

describe('several valid forms', () => {
  it('accepts any of them and reports the closest', () => {
    const forms = data.forms(lyo, 'pres.act.ind.3.pl')
    expect(forms.length).toBe(2) // with and without movable ν
    for (const f of forms) expect(checkAnswer(f, forms, 'strict').matched).toBe(f)
  })
  it('compares a wrong answer with the closest valid form', () => {
    const forms = [data.forms(logos, 'gen.sg')[0], data.forms(lyo, 'pres.act.ind.1.sg')[0]]
    const r = checkAnswer(stripAccents(forms[0]), forms, 'strict')
    expect(r.closest).toBe(forms[0])
  })
})

describe('diff for highlighting', () => {
  it('marks the differing part of the expected form', () => {
    const block = ['nom.sg', 'gen.sg', 'dat.sg', 'acc.sg'].flatMap((k) => data.forms(logos, k))
    const r = checkAnswer(data.forms(logos, 'gen.sg')[0], data.forms(logos, 'dat.sg'), 'strict', {
      stemLength: stemLength(block),
    })
    const ok = r.diff.expected.filter((s) => s.ok).map((s) => s.text).join('')
    const wrong = r.diff.expected.filter((s) => !s.ok).map((s) => s.text).join('')
    expect(ok + wrong).toBe(key(data.forms(logos, 'dat.sg')[0]))
    expect(wrong.length).toBeGreaterThan(0)
    expect(r.diff.answer.some((s) => !s.ok)).toBe(true)
  })
  it('has no wrong segments for an exact answer', () => {
    const form = data.forms(logos, 'gen.sg')[0]
    const r = checkAnswer(form, [form], 'strict')
    expect([...r.diff.answer, ...r.diff.expected].every((s) => s.ok)).toBe(true)
  })
})

describe('checkParse', () => {
  it('accepts every valid parse of a syncretic form', () => {
    const doron = data.lemma('noun:δῶρον')!
    const parses = data.parsesOf(doron, data.forms(doron, 'nom.sg')[0]).map((c) => parseCellKey(c.key))
    for (const c of ['nom', 'acc', 'voc'] as const) {
      expect(checkParse({ case: c, number: 'sg' }, parses).correct).toBe(true)
    }
    expect(checkParse({ case: 'gen', number: 'sg' }, parses).correct).toBe(false)
  })
  it('accepts middle or passive for a shared middle/passive form', () => {
    const parses = data.parsesOf(lyo, data.forms(lyo, 'pres.mp.ind.1.sg')[0]).map((c) => parseCellKey(c.key))
    for (const voice of ['mid', 'pass'] as const) {
      expect(checkParse({ tense: 'pres', voice, mood: 'ind', person: '1', number: 'sg' }, parses).correct).toBe(true)
    }
    expect(checkParse({ tense: 'pres', voice: 'act', mood: 'ind', person: '1', number: 'sg' }, parses).correct).toBe(false)
  })
  it('ignores gender for nouns and requires it for adjectives', () => {
    const agathos = data.lemma('adj:ἀγαθός')!
    const parses = data.parsesOf(agathos, data.forms(agathos, 'gen.sg.f')[0]).map((c) => parseCellKey(c.key))
    expect(checkParse({ case: 'gen', number: 'sg', gender: 'f' }, parses).correct).toBe(true)
    expect(checkParse({ case: 'gen', number: 'sg', gender: 'm' }, parses).correct).toBe(false)
    const nounParses = data.parsesOf(logos, data.forms(logos, 'gen.sg')[0]).map((c) => parseCellKey(c.key))
    expect(checkParse({ case: 'gen', number: 'sg', gender: 'm' }, nounParses).correct).toBe(true)
  })
})

describe('augment errors, more cases', () => {
  const ago = data.lemma('verb:ἄγω')!
  it('an extra augment', () => {
    const pres = data.forms(lyo, 'pres.act.ind.1.pl')[0]
    const r = checkAnswer('ε' + stripAccents(key(pres)), [pres], 'lenient', { pastTense: true })
    expect(r.errorKind).toBe('augment')
  })
  it('a temporal augment left out (vowel not lengthened)', () => {
    const impf = data.forms(ago, 'impf.act.ind.1.sg')[0]
    const pres = data.forms(ago, 'pres.act.ind.1.pl')[0]
    // the present stem's first vowel in place of the imperfect's lengthened one
    const answer = stripAccents(key(pres))[0] + stripAccents(key(impf)).slice(1)
    expect(checkAnswer(answer, [impf], 'lenient', { pastTense: true }).errorKind).toBe('augment')
  })
})

describe('checkParse across kinds', () => {
  it('a verb selection never matches a noun parse, nor the reverse', () => {
    const nounParse = parseCellKey('gen.sg')
    const verbParse = parseCellKey('pres.act.ind.1.sg')
    expect(checkParse({ tense: 'pres', voice: 'act', mood: 'ind', person: '1', number: 'sg' }, [nounParse]).correct).toBe(false)
    expect(checkParse({ case: 'gen', number: 'sg' }, [verbParse]).correct).toBe(false)
  })
})
