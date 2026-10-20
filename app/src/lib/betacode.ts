// Beta code <-> polytonic Greek, so players can type Greek without an OS Greek keyboard
// (SPEC §7). betaToGreek is safe to run on every keystroke: Greek already in the string is kept,
// and a diacritic typed after a converted letter is attached to it.

import {
  ACUTE,
  BREVE,
  CIRCUMFLEX,
  DIAERESIS,
  GRAVE,
  IOTA_SUBSCRIPT,
  MACRON,
  ROUGH,
  SMOOTH,
  finalSigma,
  nfc,
  stripLength,
} from './normalize'

const LETTERS: Record<string, string> = {
  a: 'α', b: 'β', g: 'γ', d: 'δ', e: 'ε', z: 'ζ', h: 'η', q: 'θ', i: 'ι', k: 'κ', l: 'λ',
  m: 'μ', n: 'ν', c: 'ξ', o: 'ο', p: 'π', r: 'ρ', s: 'σ', t: 'τ', u: 'υ', f: 'φ', x: 'χ',
  y: 'ψ', w: 'ω',
}
const MARKS: Record<string, string> = {
  ')': SMOOTH, '(': ROUGH, '/': ACUTE, '\\': GRAVE, '=': CIRCUMFLEX, '|': IOTA_SUBSCRIPT,
  '+': DIAERESIS, _: MACRON, '^': BREVE,
}
// Marks that exclude one another on a single letter.
const EXCLUSIVE = [new Set([ACUTE, GRAVE, CIRCUMFLEX]), new Set([SMOOTH, ROUGH]), new Set([MACRON, BREVE])]
// Order in which marks follow their letter (keeps NFC composition working: ἄ = α + ̓ + ́).
const MARK_ORDER = [MACRON, BREVE, DIAERESIS, SMOOTH, ROUGH, ACUTE, GRAVE, CIRCUMFLEX, IOTA_SUBSCRIPT]

const isGreekLetter = (ch: string) => /[α-ω]/u.test(ch)
const isMark = (ch: string) => /\p{M}/u.test(ch)

interface Cluster {
  base: string
  marks: string[]
}

function addMark(cluster: Cluster, mark: string): void {
  const group = EXCLUSIVE.find((g) => g.has(mark))
  cluster.marks = cluster.marks.filter((m) => m !== mark && !(group && group.has(m)))
  cluster.marks.push(mark)
}

export function betaToGreek(input: string): string {
  const clusters: Cluster[] = []
  for (const ch of input.normalize('NFD')) {
    const last = clusters[clusters.length - 1]
    const lower = ch.toLowerCase()
    if (ch === '*') continue // TLG capital marker: answers are lowercase
    if (LETTERS[lower]) clusters.push({ base: LETTERS[lower], marks: [] })
    else if (isGreekLetter(lower)) clusters.push({ base: lower, marks: [] })
    else if (last && isGreekLetter(last.base) && isMark(ch)) addMark(last, ch)
    else if (last && isGreekLetter(last.base) && MARKS[ch]) addMark(last, MARKS[ch])
    else clusters.push({ base: ch, marks: [] })
  }
  const text = clusters
    .map((c) => c.base + [...c.marks].sort((a, b) => MARK_ORDER.indexOf(a) - MARK_ORDER.indexOf(b)).join(''))
    .join('')
  return finalSigma(nfc(text))
}

const TO_BETA: Record<string, string> = Object.fromEntries(
  Object.entries(LETTERS).map(([latin, greek]) => [greek, latin]),
)
TO_BETA['ς'] = 's'
const MARK_TO_BETA: Record<string, string> = {
  [SMOOTH]: ')', [ROUGH]: '(', [DIAERESIS]: '+', [ACUTE]: '/', [GRAVE]: '\\', [CIRCUMFLEX]: '=', [IOTA_SUBSCRIPT]: '|',
}
// Beta code order after a letter: breathing, diaeresis, accent, iota subscript.
const BETA_ORDER = [')', '(', '+', '/', '\\', '=', '|']

/** Lowercase TLG beta code (length marks dropped), as pipeline/betacode.py writes it. */
export function greekToBeta(s: string): string {
  let out = ''
  let pending: string[] = []
  const flush = () => {
    out += pending.sort((a, b) => BETA_ORDER.indexOf(a) - BETA_ORDER.indexOf(b)).join('')
    pending = []
  }
  for (const ch of stripLength(s).toLowerCase().normalize('NFD')) {
    if (MARK_TO_BETA[ch]) pending.push(MARK_TO_BETA[ch])
    else {
      flush()
      out += TO_BETA[ch] ?? ch
    }
  }
  flush()
  return out
}
