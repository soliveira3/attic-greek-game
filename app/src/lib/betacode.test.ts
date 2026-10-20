import { describe, expect, it } from 'vitest'
import parity from './__fixtures__/normalize_parity.json'
import { betaToGreek, greekToBeta } from './betacode'
import { MACRON, nfc } from './normalize'

describe('golden forms', () => {
  it.each(parity.map((r) => [r.form, r] as const))('%s', (_form, r) => {
    expect(greekToBeta(r.form)).toBe(r.beta) // same spelling as pipeline/betacode.py
    expect(betaToGreek(r.beta)).toBe(r.key) // round trip (length marks are never needed)
    let typed = '' // as the answer box converts on every keystroke
    for (const ch of r.beta) typed = betaToGreek(typed + ch)
    expect(typed).toBe(r.key)
  })
})

describe('betaToGreek', () => {
  it('takes diacritics in any order after the letter', () => {
    expect(betaToGreek('a/)')).toBe(betaToGreek('a)/'))
    expect(betaToGreek('w|=(')).toBe(betaToGreek('w(=|'))
  })
  it('keeps one accent and one breathing per letter (the last typed wins)', () => {
    expect(betaToGreek('a//')).toBe(betaToGreek('a/'))
    expect(betaToGreek('a/=')).toBe(betaToGreek('a='))
    expect(betaToGreek('a)(')).toBe(betaToGreek('a('))
  })
  it('accepts optional length marks', () => {
    expect(betaToGreek('a_')).toBe(nfc('α' + MACRON))
  })
  it('writes ς only at the end of a word', () => {
    expect(betaToGreek('ss')).toBe('σς')
    expect(betaToGreek('s s')).toBe('ς ς')
  })
  it('ignores capitals markers and case', () => {
    expect(betaToGreek('*LU/W')).toBe(betaToGreek('lu/w'))
  })
  it('leaves other characters alone; a mark with no letter yet stays visible', () => {
    expect(betaToGreek('1 )a')).toBe('1 ' + betaToGreek('a)'))
    expect(betaToGreek('1 )')).toBe('1 )')
  })
})

describe('greekToBeta', () => {
  it('leaves non-Greek characters alone', () => {
    expect(greekToBeta('1 2')).toBe('1 2')
  })
})

describe('marks typed before the letter', () => {
  it('at the start of a word, or after the capital marker', () => {
    expect(betaToGreek(')a')).toBe(betaToGreek('a)'))
    expect(betaToGreek('*)a')).toBe(betaToGreek('a)'))
    let typed = ''
    for (const ch of '*)a/') typed = betaToGreek(typed + ch)
    expect(typed).toBe(betaToGreek('a)/'))
  })
  it('after a consonant, on the next vowel', () => {
    expect(betaToGreek('l/o')).toBe(betaToGreek('lo/'))
  })
  it('a breathing still goes on rho', () => {
    expect(betaToGreek('r(')).toBe(nfc('ρ' + String.fromCodePoint(0x314)))
  })
})

describe('a mark typed before a consonant', () => {
  it('stays visible until a vowel can take it', () => {
    expect(betaToGreek(')l')).toBe(')λ')
  })
})
