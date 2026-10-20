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
  MARK_ORDER,
  ROUGH,
  SMOOTH,
  finalSigma,
  nfc,
  stripLength,
  takesMark,
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

const isGreekLetter = (ch: string) => /[α-ω]/u.test(ch)
const isMark = (ch: string) => /\p{M}/u.test(ch)

interface Cluster {
  base: string
  marks: string[]
  /** A capital marker or a mark still waiting for its letter; shown as typed until then. */
  pending?: string
}

function addMark(cluster: Cluster, mark: string): void {
  const group = EXCLUSIVE.find((g) => g.has(mark))
  cluster.marks = cluster.marks.filter((m) => m !== mark && !(group && group.has(m)))
  cluster.marks.push(mark)
}

/**
 * Marks normally follow their letter. A mark typed with no vowel before it (at the start, after
 * a consonant, or after the TLG capital marker `*`) waits, still visible, for the next vowel.
 */
export function betaToGreek(input: string): string {
  const clusters: Cluster[] = []
  for (const ch of input.normalize('NFD')) {
    const last = clusters[clusters.length - 1]
    const lower = ch.toLowerCase()
    const letter = LETTERS[lower] ?? (isGreekLetter(lower) ? lower : null)
    const mark = MARKS[ch] ?? (isMark(ch) ? ch : null)
    if (ch === '*') {
      clusters.push({ base: ch, marks: [], pending: '' })
    } else if (letter) {
      const cluster: Cluster = { base: letter, marks: [] }
      const waiting: Cluster[] = []
      while (clusters.length && clusters[clusters.length - 1].pending !== undefined) waiting.unshift(clusters.pop()!)
      const marks = waiting.map((c) => c.pending!).filter(Boolean)
      if (marks.length && !marks.every((m) => takesMark(letter, m))) clusters.push(...waiting)
      else marks.forEach((m) => addMark(cluster, m))
      clusters.push(cluster)
    } else if (mark && last && last.pending === undefined && takesMark(last.base, mark)) {
      addMark(last, mark)
    } else if (mark) {
      clusters.push({ base: ch, marks: [], pending: mark })
    } else {
      clusters.push({ base: ch, marks: [] })
    }
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
