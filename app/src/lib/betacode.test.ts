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
  it('leaves other characters alone, including a mark with no letter before it', () => {
    expect(betaToGreek('1 )a')).toBe('1 )α')
  })
})

describe('greekToBeta', () => {
  it('leaves non-Greek characters alone', () => {
    expect(greekToBeta('1 2')).toBe('1 2')
  })
})
