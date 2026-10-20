import { describe, expect, it } from 'vitest'
import adjectives from '../../../data/paradigms/adjectives.json'
import nouns from '../../../data/paradigms/nouns.json'
import verbs from '../../../data/paradigms/verbs.json'
import { betaToGreek, greekToBeta } from './betacode'
import { type Strictness, STRICTNESS, checkAnswer, checkParse } from './check'
import { makeParadigms, stemLength } from './data'
import { type ParadigmFile, parseCellKey } from './features'
import { CIRCUMFLEX, IOTA_SUBSCRIPT, ROUGH, SMOOTH, displayForm, key, nfc, stripAccents, stripAll } from './normalize'

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
    const r = checkAnswer(unaugmented, [impf], 'lenient', data.checkContext(lyo, 'impf.act.ind.1.sg'))
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
    const r = checkAnswer('ε' + stripAccents(key(pres)), [pres], 'lenient', data.checkContext(lyo, 'pres.act.ind.1.pl'))
    expect(r.errorKind).toBe('augment')
  })
  it('a temporal augment left out (vowel not lengthened)', () => {
    const impf = data.forms(ago, 'impf.act.ind.1.sg')[0]
    const pres = data.forms(ago, 'pres.act.ind.1.pl')[0]
    // the present stem's first vowel in place of the imperfect's lengthened one
    const answer = stripAccents(key(pres))[0] + stripAccents(key(impf)).slice(1)
    expect(checkAnswer(answer, [impf], 'lenient', data.checkContext(ago, 'impf.act.ind.1.sg')).errorKind).toBe('augment')
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

// ---------------------------------------------------------------- review fixes (greek-checker, Phase 3)

const ctx = (ref: string, cell: string) => data.checkContext(data.lemma(ref)!, cell)
const letters = (s: string) => stripAll(key(s))
const ago = data.lemma('verb:ἄγω')!
const agoForm = data.forms(ago, 'pres.act.ind.1.sg')[0]

describe('M1/M2: answers with marks in unusual places or order', () => {
  const nfdForm = agoForm.normalize('NFD')
  const marksOfFirst = [...nfdForm].slice(1, 3) // breathing and accent on the first vowel
  it('a mark typed before its letter attaches to it (no crash, exact)', () => {
    const answer = SMOOTH + nfdForm.replace(SMOOTH, '')
    for (const mode of STRICTNESS) {
      const r = checkAnswer(answer, [agoForm], mode)
      expect(r.exact, mode).toBe(true)
    }
  })
  it('marks typed in either order on one letter are the same answer', () => {
    const answer = nfdForm[0] + [...marksOfFirst].reverse().join('') + [...nfdForm].slice(3).join('')
    expect(checkAnswer(answer, [agoForm], 'strict').exact).toBe(true)
  })
  it('unknown combining marks are ignored, tilde and inverted breve count as circumflex', () => {
    expect(checkAnswer(agoForm + String.fromCodePoint(0x307), [agoForm], 'strict').exact).toBe(true)
    const meno = data.lemma('verb:μένω')!
    const fut = data.forms(meno, 'fut.act.ind.1.sg')[0]
    for (const alias of [0x303, 0x311]) {
      expect(checkAnswer(swap(fut, CIRCUMFLEX, String.fromCodePoint(alias)), [fut], 'strict').exact).toBe(true)
    }
  })
  it('never returns a wrong answer without an error kind', () => {
    const corruptions = (f: string) => [
      f.slice(0, -1),
      f + 'ν',
      stripAll(f),
      [...f.normalize('NFD')].reverse().join(''),
      f.normalize('NFD').split('').join(String.fromCodePoint(0x301)),
      String.fromCodePoint(0x313) + f,
    ]
    for (const f of goldenForms) {
      for (const answer of corruptions(f)) {
        for (const mode of STRICTNESS) {
          const r = checkAnswer(answer, [f], mode)
          if (!r.correct) expect(typeof r.errorKind, `${answer} vs ${f} (${mode})`).toBe('string')
          else expect(r.errorKind).toBeNull()
        }
      }
    }
  })
})

describe('M3: another form of the same word', () => {
  const meno = data.lemma('verb:μένω')!
  const pres = data.forms(meno, 'pres.act.ind.1.sg')[0]
  const fut = data.forms(meno, 'fut.act.ind.1.sg')
  it('the present typed for the (liquid) future is wrong in strict and ignore-accents', () => {
    for (const mode of ['strict', 'ignore-accents'] as const) {
      const r = checkAnswer(pres, fut, mode, ctx('verb:μένω', 'fut.act.ind.1.sg'))
      expect([r.correct, r.errorKind, r.confusedWith], mode).toEqual([false, 'accent', ['pres.act.ind.1.sg']])
    }
  })
  it('lenient compares letters only: accepted, naming the other form', () => {
    const r = checkAnswer(pres, fut, 'lenient', ctx('verb:μένω', 'fut.act.ind.1.sg'))
    expect([r.correct, r.notes, r.confusedWith]).toEqual([true, ['accent'], ['pres.act.ind.1.sg']])
  })
  it('still forgives a missing accent that matches no other form', () => {
    const r = checkAnswer(stripAll(fut[0]), fut, 'lenient', ctx('verb:μένω', 'fut.act.ind.1.sg'))
    expect([r.correct, r.confusedWith]).toEqual([true, []])
  })
})

describe('M4: stems per mood', () => {
  it('the imperfect typed for the second aorist is a stem error', () => {
    const leipo = data.lemma('verb:λείπω')!
    const impf = data.forms(leipo, 'impf.act.ind.1.sg')[0]
    const r = checkAnswer(impf, data.forms(leipo, 'aor.act.ind.1.sg'), 'lenient', ctx('verb:λείπω', 'aor.act.ind.1.sg'))
    expect(r.errorKind).toBe('stem')
  })
})

describe('M5: augment errors', () => {
  const augmentCase = (ref: string, cell: string, answer: string) => {
    const lemma = data.lemma(ref)!
    return checkAnswer(answer, data.forms(lemma, cell), 'lenient', ctx(ref, cell)).errorKind
  }
  const target = (ref: string, cell: string) => letters(data.forms(data.lemma(ref)!, cell)[0])
  const presStem = (ref: string) => letters(data.forms(data.lemma(ref)!, 'pres.act.ind.1.pl')[0]).slice(0, -4)
  it.each([
    ['ε for ει', 'verb:ἔχω', 'impf.act.ind.1.sg', () => target('verb:ἔχω', 'impf.act.ind.1.sg').slice(0, 1) + target('verb:ἔχω', 'impf.act.ind.1.sg').slice(2)],
    ['diphthong not lengthened', 'verb:αἴρω', 'impf.act.ind.1.sg', () => letters(data.forms(data.lemma('verb:αἴρω')!, 'pres.act.ind.1.sg')[0]).slice(0, 2) + target('verb:αἴρω', 'impf.act.ind.1.sg').slice(1)],
    ['οι for ῳ', 'verb:οἴομαι', 'aor.pass.ind.1.sg', () => letters(data.lemma('verb:οἴομαι')!.lemma).slice(0, 2) + target('verb:οἴομαι', 'aor.pass.ind.1.sg').slice(1)],
    ['ε added to a vowel', 'verb:ἄγω', 'impf.act.ind.1.sg', () => 'ε' + letters(agoForm).slice(0, 1) + target('verb:ἄγω', 'impf.act.ind.1.sg').slice(1)],
    ['compound without augment', 'verb:ἀποκτείνω', 'impf.act.ind.1.sg', () => presStem('verb:ἀποκτείνω') + 'ον'],
    ['compound augmented at the front', 'verb:συμβαίνω', 'impf.act.ind.1.sg', () => 'ε' + presStem('verb:συμβαίνω') + 'ον'],
  ])('%s', (_name, ref, cell, answer) => {
    expect(augmentCase(ref, cell, answer())).toBe('augment')
  })
  it('an augment added outside the past tenses', () => {
    const pres = data.forms(lyo, 'pres.act.ind.1.pl')
    expect(checkAnswer('ε' + letters(pres[0]), pres, 'lenient', ctx('verb:λύω', 'pres.act.ind.1.pl')).errorKind).toBe('augment')
  })
  it('a stem vowel error at the start of a present is not an augment error', () => {
    const leipo = data.lemma('verb:λείπω')!
    const pres = data.forms(leipo, 'pres.act.ind.1.sg')
    const answer = letters(pres[0]).slice(0, 1) + letters(pres[0]).slice(2) // drop the ε of the diphthong
    expect(checkAnswer(answer, pres, 'lenient', ctx('verb:λείπω', 'pres.act.ind.1.sg')).errorKind).toBe('stem')
  })
})

describe('M6: iota written on the line', () => {
  const dat = data.forms(logos, 'dat.sg')[0]
  const adscript = nfc(dat.normalize('NFD').replace(IOTA_SUBSCRIPT, '') + 'ι')
  it.each([
    ['strict', false, 'subscript', []],
    ['ignore-accents', true, null, ['subscript']],
    ['lenient', true, null, ['subscript']],
  ] as const)('%s', (mode, correct, kind, notes) => {
    const r = checkAnswer(adscript, [dat], mode)
    expect([r.correct, r.errorKind, r.notes]).toEqual([correct, kind, notes])
  })
})

describe('minor fixes', () => {
  it('refuses to check against no forms', () => {
    expect(() => checkAnswer('x', [], 'strict')).toThrow()
  })
  it('highlights only what the mode counts as wrong, and shows the stored spelling', () => {
    const target = data.forms(lyo, 'pres.act.ind.1.pl')[0] // carries a length mark
    const answer = stripAccents(key(target)).slice(0, -1) // accent missing and the ending cut short
    const r = checkAnswer(answer, [target], 'ignore-accents', ctx('verb:λύω', 'pres.act.ind.1.pl'))
    expect(r.diff.expected.map((s) => s.text).join('')).toBe(nfc(target))
    expect(r.diff.expected[0].ok).toBe(true) // the accent on the stem is not highlighted
    expect(r.diff.expected.some((s) => !s.ok)).toBe(true)
  })
  it('reports every kind of error, and a parse error for Parse it', () => {
    const form = goldenForms.find((f) => f.normalize('NFD').includes(ROUGH))!
    const r = checkAnswer(stripAll(form), [form], 'strict')
    expect(r.errors).toEqual(expect.arrayContaining(['breathing', 'accent']))
    const parses = data.parsesOf(logos, data.forms(logos, 'gen.sg')[0]).map((c) => parseCellKey(c.key))
    expect(checkParse({ case: 'dat', number: 'sg' }, parses).errorKind).toBe('parse')
    expect(checkParse({ case: 'gen', number: 'sg' }, parses).errorKind).toBeNull()
  })
})

describe('coverage of remaining branches', () => {
  it('a temporal augment added outside the past tenses', () => {
    const pres = data.forms(ago, 'pres.act.ind.1.pl')
    const impf = data.forms(ago, 'impf.act.ind.1.pl')
    const answer = letters(impf[0])[0] + letters(pres[0]).slice(1) // lengthened vowel on a present
    expect(checkAnswer(answer, pres, 'lenient', ctx('verb:ἄγω', 'pres.act.ind.1.pl')).errorKind).toBe('augment')
  })
  it('between valid forms as far apart in letters, prefers the one closer in marks', () => {
    const form = data.forms(logos, 'gen.sg')[0]
    const answer = form.slice(0, -1) + 'ς' // last letter wrong, accent kept
    expect(checkAnswer(answer, [stripAccents(form), form], 'strict').closest).toBe(form)
  })
})

// ---------------------------------------------------------------- second review (verification of the fixes)

describe('other forms are only those being drilled', () => {
  const dat = data.forms(logos, 'dat.sg')
  const dualSpelling = data.forms(logos, 'nom.du')[0] // the dative's letters and accent, no subscript
  it('a dual form does not count while the dual is not drilled', () => {
    const r = checkAnswer(dualSpelling, dat, 'lenient', ctx('noun:λόγος', 'dat.sg'))
    expect([r.correct, r.notes, r.confusedWith]).toEqual([true, ['subscript'], []])
  })
  it('with the dual drilled it is named, and lenient still accepts', () => {
    const r = checkAnswer(dualSpelling, dat, 'lenient', data.checkContext(logos, 'dat.sg', { dual: true }))
    expect([r.correct, r.confusedWith]).toEqual([true, ['nom.du', 'acc.du', 'voc.du']])
  })
  it('ignore-accents: the nominative dual for the nominative singular only counts with the dual on', () => {
    const thal = data.lemma('noun:θάλαττα')!
    const sg = data.forms(thal, 'nom.sg')
    const du = data.forms(thal, 'nom.du')[0]
    const off = checkAnswer(du, sg, 'ignore-accents', data.checkContext(thal, 'nom.sg'))
    expect([off.correct, off.notes]).toEqual([true, ['accent']])
    const on = checkAnswer(du, sg, 'ignore-accents', data.checkContext(thal, 'nom.sg', { dual: true }))
    expect([on.correct, on.confusedWith.includes('nom.du')]).toEqual([false, true])
    // only the two vowels whose accent moved are highlighted
    expect(on.diff.expected.filter((x) => !x.ok).map((x) => stripAll(x.text)).join('')).toBe('αα')
  })
  it('names every cell the answer is exactly', () => {
    const axios = data.lemma('adj:ἄξιος')!
    const r = checkAnswer(data.forms(axios, 'nom.pl.n')[0], data.forms(axios, 'nom.sg.f'), 'strict', data.checkContext(axios, 'nom.sg.f'))
    expect(r.confusedWith).toEqual(expect.arrayContaining(['nom.pl.n', 'acc.pl.n', 'voc.pl.n']))
  })
})

describe('errors inside a preverb are not augment errors', () => {
  const imperfect = (ref: string) => letters(data.forms(data.lemma(ref)!, 'impf.act.ind.1.sg')[0])
  const kind = (ref: string, answer: string) =>
    checkAnswer(answer, data.forms(data.lemma(ref)!, 'impf.act.ind.1.sg'), 'lenient', ctx(ref, 'impf.act.ind.1.sg')).errorKind
  const presStem = (ref: string) => letters(data.forms(data.lemma(ref)!, 'pres.act.ind.1.pl')[0]).slice(0, -4)
  it.each([
    ['first consonant changed', 'verb:διαφέρω', (t: string) => 'π' + t.slice(1)],
    ['first consonant changed', 'verb:παρέχω', (t: string) => 'κ' + t.slice(1)],
    ['first letter dropped', 'verb:καταλαμβάνω', (t: string) => t.slice(1)],
    ['consonant inside the preverb', 'verb:ὑπάρχω', (t: string) => t[0] + 'τ' + t.slice(2)],
    ['assimilated consonant changed', 'verb:συμβαίνω', (t: string) => t.slice(0, 2) + 'τ' + t.slice(3)],
    ['consonant in place of the augment', 'verb:παρέχω', (t: string) => t.slice(0, 4) + 'τ' + t.slice(5)],
  ])('%s (%s)', (_name, ref, mutate) => {
    expect(kind(ref, mutate(imperfect(ref)))).toBe('stem')
  })
  it('the unaugmented compound is an augment error', () => {
    expect(kind('verb:συμβαίνω', presStem('verb:συμβαίνω') + 'ον')).toBe('augment')
  })
})

describe('an invisible augment does not turn ending errors into augment errors', () => {
  it('ἥκω and προσήκω', () => {
    const heko = data.lemma('verb:ἥκω')!
    const pres = data.forms(heko, 'pres.act.ind.1.pl')
    const wrongEnding = letters(pres[0]).slice(0, 2) + 'ω' + letters(pres[0]).slice(3)
    expect(checkAnswer(wrongEnding, pres, 'lenient', ctx('verb:ἥκω', 'pres.act.ind.1.pl')).errorKind).toBe('ending')
    const impf3 = data.forms(heko, 'impf.act.ind.3.sg')
    expect(checkAnswer(letters(impf3[0]).slice(0, -1) + 'αν', impf3, 'lenient', ctx('verb:ἥκω', 'impf.act.ind.3.sg')).errorKind).toBe('ending')
    const proseko = data.lemma('verb:προσήκω')!
    const p3 = data.forms(proseko, 'impf.act.ind.3.sg')
    const first = data.forms(proseko, 'impf.act.ind.1.sg')[0]
    expect(checkAnswer(first, p3, 'lenient', ctx('verb:προσήκω', 'impf.act.ind.3.sg')).errorKind).toBe('ending')
  })
})

describe('the imperfect typed for the present is an augment error', () => {
  it.each(['verb:ἔχω', 'verb:ἀποκτείνω'])('%s', (ref) => {
    const lemma = data.lemma(ref)!
    const impf = data.forms(lemma, 'impf.act.ind.1.pl')[0]
    const r = checkAnswer(impf, data.forms(lemma, 'pres.act.ind.1.pl'), 'ignore-accents', ctx(ref, 'pres.act.ind.1.pl'))
    expect([r.correct, r.errorKind]).toEqual([false, 'augment'])
  })
})

describe('errors and notes', () => {
  it('a letter error is listed with the diacritic errors the mode counts; forgiven ones are notes', () => {
    const impf = data.forms(lyo, 'impf.act.ind.1.pl')
    const answer = stripAll(impf[0]).slice(1) // no augment, no accent
    const strict = checkAnswer(answer, impf, 'strict', ctx('verb:λύω', 'impf.act.ind.1.pl'))
    expect([strict.errors, strict.notes]).toEqual([['augment', 'accent'], []])
    const ignore = checkAnswer(answer, impf, 'ignore-accents', ctx('verb:λύω', 'impf.act.ind.1.pl'))
    expect([ignore.errors, ignore.notes]).toEqual([['augment'], ['accent']])
  })
  it('a missing subscript with a missing accent in ignore-accents', () => {
    const dat = data.forms(logos, 'dat.sg')
    const r = checkAnswer(stripAll(dat[0]), dat, 'ignore-accents', ctx('noun:λόγος', 'dat.sg'))
    expect([r.errors, r.notes]).toEqual([['subscript'], ['accent']])
  })
  it('strict: iota on the line plus a missing accent', () => {
    const dat = data.forms(logos, 'dat.sg')
    const r = checkAnswer(stripAll(dat[0]) + 'ι', dat, 'strict', ctx('noun:λόγος', 'dat.sg'))
    expect([r.errorKind, r.errors]).toEqual(['subscript', ['subscript', 'accent']])
  })
})

describe('infinitive stems come from the indicative stem', () => {
  it('present and aorist of λύω', () => {
    expect(data.checkContext(lyo, 'pres.act.inf').stemLength).toBe(2)
    expect(data.checkContext(lyo, 'aor.act.inf').stemLength).toBe(3)
    const inf = data.forms(lyo, 'pres.act.inf')
    const wrongEnding = letters(inf[0]).slice(0, 2) + 'οιν'
    expect(checkAnswer(wrongEnding, inf, 'lenient', ctx('verb:λύω', 'pres.act.inf')).errorKind).toBe('ending')
  })
  it('an aorist infinitive after a temporal augment', () => {
    const erchomai = data.lemma('verb:ἔρχομαι')!
    const inf = data.forms(erchomai, 'aor.act.inf')
    expect(data.checkContext(erchomai, 'aor.act.inf').stemLength).toBe(3)
    const wrongStem = letters(inf[0]).slice(0, 2) + 'κ' + letters(inf[0]).slice(3)
    expect(checkAnswer(wrongStem, inf, 'lenient', ctx('verb:ἔρχομαι', 'aor.act.inf')).errorKind).toBe('stem')
  })
})

describe('diff display', () => {
  it('an answer accepted through iota on the line shows nothing wrong', () => {
    const dat = data.forms(logos, 'dat.sg')
    const r = checkAnswer(stripAccents(key(dat[0])).normalize('NFD').replace(IOTA_SUBSCRIPT, '') + 'ι', dat, 'lenient')
    expect(r.correct).toBe(true)
    expect([...r.diff.answer, ...r.diff.expected].every((x) => x.ok)).toBe(true)
  })
  it('never shows a macron and a breve together', () => {
    const hieros = data.lemma('adj:ἱερός')!
    const form = data.forms(hieros, 'nom.sg.m')[0]
    const r = checkAnswer(stripAll(form), [form], 'strict')
    expect(r.diff.expected.map((x) => x.text).join('')).toBe(displayForm(form))
    expect(displayForm(form)).not.toBe(nfc(form))
  })
})

describe('a slip in the ending of a very short form is not an augment error', () => {
  it('οἴομαι imperfect 2nd sg.', () => {
    const oiomai = data.lemma('verb:οἴομαι')!
    const forms = data.forms(oiomai, 'impf.mp.ind.2.sg')
    const l = letters(forms[0])
    const answer = l.slice(0, 1) + 'α' + l.slice(2) // the ending's vowel changed
    expect(checkAnswer(answer, forms, 'lenient', ctx('verb:οἴομαι', 'impf.mp.ind.2.sg')).errorKind).toBe('ending')
  })
})
