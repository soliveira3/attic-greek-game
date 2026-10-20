import { describe, expect, it } from 'vitest'
import type { CheckResult } from './check'
import { listWords, verdict } from './feedback'

function result(patch: Partial<CheckResult>): CheckResult {
  return {
    correct: false,
    exact: false,
    matched: null,
    closest: 'x',
    errorKind: null,
    errors: [],
    notes: [],
    confusedWith: [],
    diff: { answer: [], expected: [] },
    ...patch,
  }
}

describe('listWords', () => {
  it('joins error kinds in plain words', () => {
    expect(listWords([])).toBe('')
    expect(listWords(['accent'])).toBe('the accent')
    expect(listWords(['ending', 'accent'])).toBe('the ending and the accent')
    expect(listWords(['stem', 'breathing', 'subscript'])).toBe('the stem, the breathing and the iota subscript')
  })
})

describe('verdict', () => {
  it('a plain right answer', () => {
    expect(verdict(result({ correct: true, exact: true }))).toEqual({ ok: true, headline: 'Correct', details: [] })
  })
  it('a right answer the mode forgave something in', () => {
    expect(verdict(result({ correct: true, notes: ['accent'] })).details).toEqual(['Counted right, but check the accent.'])
  })
  it('a lenient answer that spells another form too', () => {
    const v = verdict(result({ correct: true, notes: ['accent'], confusedWith: ['gen.pl', 'acc.pl'] }))
    expect(v.details).toEqual(['Counted right, but check the accent.', 'The same letters also spell the gen. pl. and the acc. pl.'])
  })
  it('a blank answer', () => {
    expect(verdict(result({ errorKind: 'blank', errors: ['blank'] }))).toEqual({ ok: false, headline: 'No answer', details: [] })
  })
  it('a wrong answer names what is wrong', () => {
    expect(verdict(result({ errorKind: 'ending', errors: ['ending'] })).details).toEqual(['The ending is wrong.'])
    expect(verdict(result({ errorKind: 'augment', errors: ['augment', 'accent'] })).details).toEqual([
      'The augment and the accent are wrong.',
    ])
    expect(verdict(result({ errorKind: 'ending', errors: ['ending'], notes: ['accent'] })).details).toEqual([
      'The ending is wrong.',
      'Check the accent too.',
    ])
  })
  it('another form of the word is named', () => {
    const v = verdict(result({ errorKind: 'accent', errors: ['accent'], confusedWith: ['pres.act.ind.1.sg'] }))
    expect(v).toEqual({ ok: false, headline: 'Not quite', details: ['That is the pres. act. 1 sg. form.'] })
  })
})
