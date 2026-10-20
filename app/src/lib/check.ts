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
  displayForm,
  nfc,
  stripAccents,
  stripAll,
} from './normalize'

export const STRICTNESS = ['strict', 'ignore-accents', 'lenient'] as const
export type Strictness = (typeof STRICTNESS)[number]

/**
 * What can be wrong with an answer. `parse` is for Parse it; `blank` for an empty answer.
 * A diaeresis difference counts as `accent`, as in SPEC §6.
 */
export type ErrorKind = 'accent' | 'breathing' | 'subscript' | 'augment' | 'ending' | 'stem' | 'parse' | 'blank'

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
  /** The main reason the answer is wrong; null when it is correct. */
  errorKind: ErrorKind | null
  /** Every reason the answer is wrong, main one first; empty when it is correct. */
  errors: ErrorKind[]
  /** Differences the strictness setting forgave (e.g. the accent in ignore-accents mode). */
  notes: ErrorKind[]
  /**
   * The cells of the same lemma (among those being drilled) whose form the answer is exactly.
   * In strict and ignore-accents mode such an answer is wrong; lenient mode only mentions it.
   */
  confusedWith: string[]
  /**
   * The answer (as normalised) and the closest valid form (as stored, with any length marks),
   * split into parts the mode counts as right and wrong.
   */
  diff: { answer: Segment[]; expected: Segment[] }
}

export interface CheckOptions {
  /** Letters of the stem (data.checkContext): decides "wrong ending" vs "wrong stem". */
  stemLength?: number
  /** The prompt is an augmented tense (imperfect or aorist indicative). */
  pastTense?: boolean
  /** Verbs only: the letter where the augment goes (after a compound's preverb). */
  augmentAt?: number
  /** The lemma (present form): tells an unaugmented compound from an error in its preverb. */
  lemma?: string
  /** Present or imperfect prompts: the same person in the other tense; typing it is an augment error. */
  augmentedTwins?: string[]
  /** Forms of the lemma's other cells being drilled (see `confusedWith`). */
  otherForms?: { cell: string; forms: string[] }[]
}

/** Error kinds each mode counts; the others are forgiven and reported as notes. */
const COUNTED: Record<Strictness, Set<ErrorKind>> = {
  strict: new Set(['accent', 'breathing', 'subscript', 'augment', 'ending', 'stem', 'blank']),
  'ignore-accents': new Set(['breathing', 'subscript', 'augment', 'ending', 'stem', 'blank']),
  lenient: new Set(['augment', 'ending', 'stem', 'blank']),
}

const LEVEL: Record<Strictness, (s: string) => string> = {
  strict: (s) => s,
  'ignore-accents': stripAccents,
  lenient: stripAll,
}

const BREATHINGS = new Set([SMOOTH, ROUGH])
const ACCENT_MARKS = new Set([ACUTE, GRAVE, CIRCUMFLEX, DIAERESIS])
const SUBSCRIPTS = new Set([IOTA_SUBSCRIPT])
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

/** The same form with each iota subscript written on the line (ῳ -> ωι). */
/** Iota subscript written on the line (ῳ → ωι). */
export function adscript(s: string): string {
  return nfc(clusters(s).map((c) => (c.includes(IOTA_SUBSCRIPT) ? c.replace(IOTA_SUBSCRIPT, '') + 'ι' : c)).join(''))
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

function commonSuffix(a: string, b: string): number {
  let n = 0
  while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) n++
  return n
}

const onlyVowels = (s: string) => [...s].every((ch) => VOWELS.includes(ch))

/**
 * An augment error: the letters differ only around where the augment goes (the first two letters,
 * or just after a compound's preverb).
 * - Past tenses: a missing, wrong or misplaced augment (εἶχον / ἔχον, ᾖρον / αἶρον,
 *   ἀπέκτεινον / ἀποκτείνον). A difference starting inside a compound's preverb counts only if the
 *   answer is the unaugmented compound (it continues like the present) or puts the augment in front
 *   of it (ἐσυμβαίνον, ἠποκτείνον); any other slip there is a stem error.
 * - Other tenses: an augment added at the start.
 */
function isAugmentError(a: string, t: string, opts: CheckOptions): boolean {
  const at = opts.augmentAt ?? 0
  const lemma = stripAll(opts.lemma ?? '')
  const p = commonPrefix(a, t)
  const s = commonSuffix(a.slice(p), t.slice(p))
  const ra = a.slice(p, a.length - s)
  const rt = t.slice(p, t.length - s)
  if (!ra && !rt) return false
  if (p + Math.max(ra.length, rt.length) > at + 2) return false
  if (p >= (opts.stemLength ?? Infinity)) return false // the difference is in the ending
  if (!opts.pastTense) {
    const lengthened = ra.length === 1 && rt.length === 1 && 'ηω'.includes(ra) && 'αεο'.includes(rt)
    return p === at && onlyVowels(ra) && onlyVowels(rt) && (ra.length > rt.length || lengthened)
  }
  if (p >= at) return onlyVowels(ra) && onlyVowels(rt)
  const continuesLemma = (x: string) => lemma.length > 0 && commonPrefix(x, lemma) > at
  if (continuesLemma(a)) return true
  if (!VOWELS.includes(a[0])) return false
  const rest = a.slice(1)
  const lengthenedFront = 'ηω'.includes(a[0]) && commonPrefix(rest, lemma.slice(1)) >= at
  return continuesLemma(rest) || commonPrefix(rest, t) > at || lengthenedFront
}

function letterError(answer: string, target: string, opts: CheckOptions): ErrorKind {
  const a = stripAll(answer)
  const t = stripAll(target)
  if (opts.augmentedTwins?.some((f) => stripAll(f) === a)) return 'augment'
  if (opts.augmentAt !== undefined && isAugmentError(a, t, opts)) return 'augment'
  return commonPrefix(a, t) >= (opts.stemLength ?? 0) ? 'ending' : 'stem'
}

/** Pairs of cluster indexes whose letters line up (longest common subsequence of letters). */
function alignLetters(a: string[], t: string[]): [number, number][] {
  const base = (c: string) => stripAll(c)
  const lcs = Array.from({ length: a.length + 1 }, () => new Array<number>(t.length + 1).fill(0))
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = t.length - 1; j >= 0; j--) {
      lcs[i][j] = base(a[i]) === base(t[j]) ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
    }
  }
  const pairs: [number, number][] = []
  for (let i = 0, j = 0; i < a.length && j < t.length; ) {
    if (base(a[i]) === base(t[j])) pairs.push([i++, j++])
    else if (lcs[i + 1][j] >= lcs[i][j + 1]) i++
    else j++
  }
  return pairs
}

/** Diacritic differences on letters that line up: breathing, subscript, accent. */
function markDifferences(answer: string, target: string): ErrorKind[] {
  const a = clusters(answer)
  const t = clusters(target)
  const pairs = alignLetters(a, t)
  const differs = (kinds: Set<string>) => pairs.some(([i, j]) => marks(a[i], kinds) !== marks(t[j], kinds))
  const out: ErrorKind[] = []
  if (differs(BREATHINGS)) out.push('breathing')
  if (differs(SUBSCRIPTS)) out.push('subscript')
  if (differs(ACCENT_MARKS)) out.push('accent')
  return out
}

/** A letter error first if the letters differ (augment, stem or ending), then breathing, subscript, accent. */
function differences(answer: string, target: string, opts: CheckOptions): ErrorKind[] {
  const letters = stripAll(answer) === stripAll(target) ? [] : [letterError(answer, target, opts)]
  return [...letters, ...markDifferences(answer, target)]
}

/**
 * The answer and the expected form split into right and wrong parts: letters are lined up first,
 * then a lined-up letter is wrong only if it differs in a way `same` counts. An accepted answer
 * shows nothing wrong. Expected parts are the stored form as displayed (displayForm).
 */
function diffSegments(
  answer: string,
  target: string,
  stored: string,
  same: (x: string, y: string) => boolean,
  accepted: boolean,
): { answer: Segment[]; expected: Segment[] } {
  const shownForm = displayForm(stored)
  if (accepted) return { answer: [{ text: nfc(answer), ok: true }], expected: [{ text: shownForm, ok: true }] }
  const a = clusters(answer)
  const t = clusters(target)
  const shown = clusters(shownForm)
  /* v8 ignore next -- defensive: canon() and displayForm() only remove marks, so clusters align */
  const display = shown.length === t.length ? shown : t
  const aOk = new Array<boolean>(a.length).fill(false)
  const tOk = new Array<boolean>(t.length).fill(false)
  for (const [i, j] of alignLetters(a, t)) {
    aOk[i] = tOk[j] = same(a[i], t[j])
  }
  const segments = (cs: string[], ok: boolean[]): Segment[] => {
    const out: Segment[] = []
    cs.forEach((c, i) => {
      const last = out[out.length - 1]
      if (last && last.ok === ok[i]) last.text += c
      else out.push({ text: c, ok: ok[i] })
    })
    return out.map((x) => ({ ...x, text: x.text.normalize('NFC') }))
  }
  return { answer: segments(a, aOk), expected: segments(display, tOk) }
}

export function checkAnswer(
  answer: string,
  validForms: string[],
  strictness: Strictness,
  opts: CheckOptions = {},
): CheckResult {
  if (!validForms.length) throw new Error('checkAnswer needs at least one valid form')
  const typed = canon(answer)
  const level = LEVEL[strictness]
  const candidates = validForms.map((form) => ({ form, c: canon(form) }))
  const exact = candidates.find((v) => v.c === typed)
  const confusedWith =
    exact || !typed ? [] : (opts.otherForms ?? []).filter((o) => o.forms.some((f) => canon(f) === typed)).map((o) => o.cell)
  const rejectedAsOther = confusedWith.length > 0 && strictness !== 'lenient'
  const open = !exact && !rejectedAsOther
  const byMode = open ? candidates.find((v) => level(v.c) === level(typed)) : undefined
  const byAdscript = open && !byMode ? candidates.find((v) => level(adscript(v.c)) === level(typed)) : undefined
  const accepted = exact ?? byMode ?? (strictness === 'strict' ? undefined : byAdscript)
  // iota written on the line, whatever else differs (strict mode, or another slip besides)
  const adscriptLetters = accepted ? undefined : candidates.find((v) => stripAll(adscript(v.c)) === stripAll(typed) && stripAll(v.c) !== stripAll(typed))
  const nearest =
    accepted ??
    adscriptLetters ??
    [...candidates].sort(
      (x, y) =>
        editDistance(stripAll(typed), stripAll(x.c)) - editDistance(stripAll(typed), stripAll(y.c)) ||
        editDistance(typed, x.c) - editDistance(typed, y.c),
    )[0]
  const viaAdscript = nearest === byAdscript || nearest === adscriptLetters

  let kinds: ErrorKind[]
  if (!typed) kinds = ['blank']
  else if (viaAdscript) kinds = ['subscript', ...differences(typed, adscript(nearest.c), opts).filter((k) => k !== 'subscript')]
  else kinds = differences(typed, nearest.c, opts)

  let errors: ErrorKind[] = []
  let notes: ErrorKind[] = []
  if (accepted) notes = exact ? [] : kinds
  else if (rejectedAsOther) {
    // another drilled form: its counted differences, or (if the mode forgives them all) all of them
    const counted = kinds.filter((k) => COUNTED[strictness].has(k))
    errors = counted.length ? counted : kinds
    notes = counted.length ? kinds.filter((k) => !COUNTED[strictness].has(k)) : []
  } else {
    errors = kinds.filter((k) => COUNTED[strictness].has(k))
    notes = kinds.filter((k) => !COUNTED[strictness].has(k))
  }
  /* v8 ignore next -- defensive: a wrong answer always differs in a way its mode counts */
  if (!accepted && !errors.length) errors = ['accent']

  const same = rejectedAsOther ? LEVEL.strict : level
  return {
    correct: Boolean(accepted),
    exact: Boolean(exact),
    matched: accepted?.form ?? null,
    closest: nearest.form,
    errorKind: accepted ? null : errors[0],
    errors: accepted ? [] : errors,
    notes,
    confusedWith,
    diff: diffSegments(typed, nearest.c, nearest.form, (x, y) => same(x) === same(y), Boolean(accepted)),
  }
}

// ---------------------------------------------------------------------------- Parse it

/** What the player picked in Parse it: one value per feature (voice is a single voice). */
export type ParseSelection =
  | { case: Case; number: GNumber; gender?: Gender }
  | { tense: Tense; voice: Voice; mood: Mood; person?: Person; number?: GNumber }

export interface ParseResult {
  correct: boolean
  /** `parse` when the selection matches no valid parse, for the attempt record. */
  errorKind: 'parse' | null
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
  return { correct: matching.length > 0, errorKind: matching.length ? null : 'parse', matching }
}
