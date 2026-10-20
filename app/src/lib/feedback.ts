// Plain-words feedback on a checked answer (SPEC §5: name the kind of error).

import type { CheckResult, ErrorKind } from './check'
import { cellLabel } from './features'

export const ERROR_WORDS: Record<ErrorKind, string> = {
  accent: 'the accent',
  breathing: 'the breathing',
  subscript: 'the iota subscript',
  augment: 'the augment',
  ending: 'the ending',
  stem: 'the stem',
  parse: 'the parse',
  blank: 'the answer',
}

function join(words: string[]): string {
  return words.length < 2 ? words.join('') : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`
}

/** "the ending and the accent". */
export function listWords(kinds: ErrorKind[]): string {
  return join(kinds.map((k) => ERROR_WORDS[k]))
}

const cells = (keys: string[]) => join(keys.map((k) => `the ${cellLabel(k, { short: true })}`))
const capitalised = (s: string) => s[0].toUpperCase() + s.slice(1)
// short labels end in an abbreviation point already ("gen. pl.")
const sentence = (s: string) => (s.endsWith('.') ? s : `${s}.`)

export interface Verdict {
  ok: boolean
  headline: string
  details: string[]
}

export function verdict(r: CheckResult): Verdict {
  if (r.correct) {
    const details = []
    if (r.notes.length) details.push(`Counted right, but check ${listWords(r.notes)}.`)
    if (r.confusedWith.length) details.push(sentence(`The same letters also spell ${cells(r.confusedWith)}`))
    return { ok: true, headline: 'Correct', details }
  }
  if (r.errorKind === 'blank') return { ok: false, headline: 'No answer', details: [] }
  const wrong = `${capitalised(listWords(r.errors))} ${r.errors.length > 1 ? 'are' : 'is'} wrong.`
  if (r.confusedWith.length) {
    return { ok: false, headline: 'Not quite', details: [`That is ${cells(r.confusedWith)} form.`, wrong] }
  }
  const details = [wrong]
  if (r.notes.length) details.push(`Check ${listWords(r.notes)} too.`)
  return { ok: false, headline: 'Not quite', details }
}
