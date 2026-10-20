import { describe, expect, it } from 'vitest'
import parity from './__fixtures__/normalize_parity.json'
import { canon, displayForm, finalSigma, key, nfc, stripAccents, stripAll, stripLength } from './normalize'

const cp = (...codes: number[]) => String.fromCodePoint(...codes)
const MACRON = cp(0x304)
const BREVE = cp(0x306)
const nfd = (s: string) => s.normalize('NFD')

// Every golden form, with what pipeline/normalize.py returns for it (pipeline/export_parity.py).
describe('parity with pipeline/normalize.py on every golden form', () => {
  it.each(parity.map((r) => [r.form, r] as const))('%s', (_form, r) => {
    for (const input of [r.form, nfd(r.form)]) {
      expect(nfc(input)).toBe(r.nfc)
      expect(stripLength(input)).toBe(r.stripLength)
      expect(stripAccents(input)).toBe(r.stripAccents)
      expect(stripAll(input)).toBe(r.stripAll)
      expect(key(input)).toBe(r.key)
    }
    expect(finalSigma(r.form)).toBe(r.finalSigma)
  })
})

describe('finalSigma', () => {
  const endsInSigma = parity.filter((r) => r.stripAll.endsWith('ς')).map((r) => r.key)
  it('turns a word-final σ into ς', () => {
    expect(endsInSigma.length).toBeGreaterThan(0)
    for (const form of endsInSigma) expect(finalSigma(form.slice(0, -1) + 'σ')).toBe(form)
  })
  it('turns a medial ς into σ', () => {
    expect(finalSigma('ςα')).toBe('σα')
  })
})

describe('canon (typed answers)', () => {
  it('trims, composes, lowercases, fixes sigma and drops length marks', () => {
    for (const r of parity) {
      expect(canon(`  ${nfd(r.form)}  `)).toBe(r.key)
      // Uppercasing turns an iota subscript into a full capital iota, so skip those forms here.
      if (!nfd(r.form).includes(String.fromCodePoint(0x345))) expect(canon(r.form.toUpperCase())).toBe(r.key)
    }
  })
  it('is empty for blank input', () => {
    expect(canon('   ')).toBe('')
  })
})

describe('displayForm', () => {
  it('keeps single length marks by default', () => {
    const withMarks = parity.find((r) => r.form !== r.stripLength)!
    expect(displayForm(withMarks.form)).toBe(withMarks.nfc)
  })
  it('drops both marks where a vowel has macron and breve (either length)', () => {
    expect(displayForm('ι' + MACRON + BREVE + 'α')).toBe('ια')
  })
  it('can hide all length marks', () => {
    for (const r of parity) expect(displayForm(r.form, { lengthMarks: false })).toBe(r.stripLength)
  })
})

describe('canon folds what keyboards produce', () => {
  const agathos = parity.find((r) => r.stripAll === 'αγαθος')!.key // golden ἀγαθός
  const bare = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '')
  const accentOnly = (s: string) => [...s.normalize('NFD')].filter((c) => c !== cp(0x313)).join('')
  it('spacing or apostrophe-like breathing marks typed before the letter', () => {
    for (const mark of [0x1fbf, 0x2019, 0x2bc, 0x27, 0x2018]) {
      expect(canon(cp(mark) + accentOnly(agathos))).toBe(agathos)
    }
  })
  it('a mark typed before a vowel in mid-word goes on that vowel', () => {
    const logos = parity.find((r) => r.stripAll === 'λογος')!.key // golden λόγος
    expect(canon('λ' + cp(0x301) + bare(logos).slice(1))).toBe(logos)
  })
  it('compatibility letters and invisible characters', () => {
    expect(canon('µ')).toBe('μ')
    expect(canon(cp(0x3d1))).toBe('θ')
    expect(canon('α' + cp(0x200b) + 'β')).toBe('αβ')
  })
  it('final sigma before a non-letter, as in the pipeline', () => {
    expect(finalSigma('σ1')).toBe('ς1')
  })
})

describe('canon: more keyboard output', () => {
  const logos = parity.find((r) => r.stripAll === 'λογος')!.key // golden λόγος
  const plain = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '')
  it('spacing accents typed before a vowel', () => {
    for (const mark of [0x384, 0xb4, 0x1ffd]) expect(canon('λ' + cp(mark) + plain(logos).slice(1))).toBe(logos)
  })
  it('varia and backtick are graves', () => {
    for (const mark of [0x1fef, 0x60]) expect(canon('λο' + cp(mark) + 'γος')).toBe(nfc('λο' + cp(0x300) + 'γος'))
  })
  it('more invisible characters', () => {
    for (const ch of [0x200e, 0x200f, 0x2060]) expect(canon('α' + cp(ch) + 'β')).toBe('αβ')
  })
  it('a breathing and an accent typed before ρ: the breathing on ρ, the accent on the vowel', () => {
    expect(canon(cp(0x314) + cp(0x301) + 'ρα')).toBe(nfc('ρ' + cp(0x314) + 'α' + cp(0x301)))
  })
  it('beta-code leftovers: the capital marker is dropped, mark symbols are marks', () => {
    expect(canon(logos + '*')).toBe(logos)
    expect(canon('λο/γος')).toBe(logos)
  })
})
