// Answer checking (SPEC §6). An answer is compared with *all* valid forms for the prompt under
// the chosen strictness, and the result says what was wrong so the UI can explain it.

import type { Case, CellFeatures, GNumber, Gender, Mood, Person, Tense, Voice } from './features'
import { isVerbFeatures } from './features'
import {
  ACUTE,
  CIRCUMFLEX,
  DIAERESIS,
  GRAVE,
  IOTA_SUBSCRIPT,
  ROUGH,
  SMOOTH,
  canon,
  stripAccents,
  stripAll,
} from './normalize'

export const STRICTNESS = ['strict', 'ignore-accents', 'lenient'] as const
export type Strictness = (typeof STRICTNESS)[number]

/** Most specific first; `blank` for an empty answer. */
export type ErrorKind = 'accent' | 'breathing' | 'subscript' | 'augment' | 'ending' | 'stem' | 'blank'

export interface Segment {
  text: string
  ok: boolean
}

export interface CheckResult {
  correct: boolean
  /** Matched a valid form exactly (accents, breathings, subscripts included). */
  exact: boolean
  /** The valid form the answer was accepted as, if correct. */
  matched: string | null
  /** The valid form closest to the answer (equal to `matched` when correct). */
  closest: string
  /** Why the answer is wrong; null when it is correct. */
  errorKind: ErrorKind | null
  /** Differences the strictness setting forgave (e.g. the accent in ignore-accents mode). */
  notes: ErrorKind[]
  /** The answer and the closest valid form, split into matching and differing parts. */
  diff: { answer: Segment[]; expected: Segment[] }
}

export interface CheckOptions {
  /** Letters of the stem shared by the block's forms (data.stemLength): decides ending vs stem. */
  stemLength?: number
  /** The prompt is an augmented tense (imperfect, aorist), so an initial difference is the augment. */
  pastTense?: boolean
}

const LEVEL: Record<Strictness, (s: string) => string> = {
  strict: (s) => s,
  'ignore-accents': stripAccents,
  lenient: stripAll,
}

const BREATHINGS = new Set([SMOOTH, ROUGH])
const ACCENT_MARKS = new Set([ACUTE, GRAVE, CIRCUMFLEX, DIAERESIS])
const VOWELS = 'αεηιουω'

/** Letter + its combining marks. */
function clusters(s: string): string[] {
  const out: string[] = []
  for (const ch of s.normalize('NFD')) {
    if (/\p{M}/u.test(ch) && out.length) out[out.length - 1] += ch
    else out.push(ch)
  }
  return out
}

function marks(cluster: string, kinds: Set<string>): string {
  return [...cluster].filter((ch) => kinds.has(ch)).sort().join('')
}

function editDistance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]
    prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const up = prev[j]
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1))
      diag = up
    }
  }
  return prev[b.length]
}

function commonPrefix(a: string, b: string): number {
  let n = 0
  while (n < a.length && n < b.length && a[n] === b[n]) n++
  return n
}

function letterError(answer: string, target: string, opts: CheckOptions): ErrorKind {
  const a = stripAll(answer)
  const t = stripAll(target)
  if (opts.pastTense) {
    const vowelSwap = a.slice(1) === t.slice(1) && VOWELS.includes(a[0]) && VOWELS.includes(t[0])
    if (a === t.slice(1) || t === a.slice(1) || vowelSwap) return 'augment'
  }
  return commonPrefix(a, t) >= (opts.stemLength ?? 0) ? 'ending' : 'stem'
}

/** Diacritic differences between two forms with the same letters, most important first. */
function markDifferences(answer: string, target: string): ErrorKind[] {
  const a = clusters(answer)
  const t = clusters(target)
  const out: ErrorKind[] = []
  const differs = (kinds: Set<string>) => a.some((c, i) => marks(c, kinds) !== marks(t[i], kinds))
  if (differs(BREATHINGS)) out.push('breathing')
  if (differs(new Set([IOTA_SUBSCRIPT]))) out.push('subscript')
  if (differs(ACCENT_MARKS)) out.push('accent')
  return out
}

function differences(answer: string, target: string, opts: CheckOptions): ErrorKind[] {
  if (stripAll(answer) !== stripAll(target)) return [letterError(answer, target, opts)]
  return markDifferences(answer, target)
}

/** Longest-common-subsequence diff over letter clusters. */
function diffSegments(answer: string, target: string): { answer: Segment[]; expected: Segment[] } {
  const a = clusters(answer)
  const t = clusters(target)
  const lcs = Array.from({ length: a.length + 1 }, () => new Array<number>(t.length + 1).fill(0))
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = t.length - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === t[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
    }
  }
  const aOk = new Array<boolean>(a.length).fill(false)
  const tOk = new Array<boolean>(t.length).fill(false)
  for (let i = 0, j = 0; i < a.length && j < t.length; ) {
    if (a[i] === t[j]) {
      aOk[i++] = true
      tOk[j++] = true
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) i++
    else j++
  }
  const segments = (cs: string[], ok: boolean[]): Segment[] => {
    const out: Segment[] = []
    cs.forEach((c, i) => {
      const last = out[out.length - 1]
      if (last && last.ok === ok[i]) last.text += c
      else out.push({ text: c, ok: ok[i] })
    })
    return out.map((s) => ({ ...s, text: s.text.normalize('NFC') }))
  }
  return { answer: segments(a, aOk), expected: segments(t, tOk) }
}

export function checkAnswer(
  answer: string,
  validForms: string[],
  strictness: Strictness,
  opts: CheckOptions = {},
): CheckResult {
  const typed = canon(answer)
  const level = LEVEL[strictness]
  const candidates = validForms.map((form) => ({ form, c: canon(form) }))
  const exact = candidates.find((v) => v.c === typed)
  const accepted = exact ?? candidates.find((v) => level(v.c) === level(typed))
  const closest =
    accepted ??
    [...candidates].sort(
      (x, y) =>
        editDistance(stripAll(typed), stripAll(x.c)) - editDistance(stripAll(typed), stripAll(y.c)) ||
        editDistance(typed, x.c) - editDistance(typed, y.c),
    )[0]
  const diff = diffSegments(typed, closest.c)
  if (!typed) {
    return { correct: false, exact: false, matched: null, closest: closest.form, errorKind: 'blank', notes: [], diff }
  }
  const found = differences(typed, closest.c, opts)
  return {
    correct: Boolean(accepted),
    exact: Boolean(exact),
    matched: accepted?.form ?? null,
    closest: closest.form,
    errorKind: accepted ? null : found[0],
    notes: accepted && !exact ? found : [],
    diff,
  }
}

// ---------------------------------------------------------------------------- Parse it

/** What the player picked in Parse it: one value per feature (voice is a single voice). */
export type ParseSelection =
  | { case: Case; number: GNumber; gender?: Gender }
  | { tense: Tense; voice: Voice; mood: Mood; person?: Person; number?: GNumber }

export interface ParseResult {
  correct: boolean
  /** The valid parses the selection matched. */
  matching: CellFeatures[]
}

function matches(selection: ParseSelection, parse: CellFeatures): boolean {
  if (isVerbFeatures(parse)) {
    if (!('tense' in selection)) return false
    return (
      selection.tense === parse.tense &&
      parse.voice.includes(selection.voice) &&
      selection.mood === parse.mood &&
      selection.person === parse.person &&
      selection.number === parse.number
    )
  }
  if (!('case' in selection)) return false
  // Nouns have a fixed gender, so parses of noun forms carry none and any selected gender passes.
  return selection.case === parse.case && selection.number === parse.number && (!parse.gender || selection.gender === parse.gender)
}

/** Parse it is correct if the selection matches *any* valid parse of the form (SPEC §5). */
export function checkParse(selection: ParseSelection, parses: CellFeatures[]): ParseResult {
  const matching = parses.filter((p) => matches(selection, p))
  return { correct: matching.length > 0, matching }
}
