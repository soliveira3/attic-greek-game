// Loading and querying the paradigm data built by the pipeline (data/paradigms/*.json).

import type {
  GNumber,
  Lemma,
  LemmaClass,
  Mood,
  NominalCell,
  ParadigmFile,
  Pos,
  Tense,
  VerbCell,
  VoiceGroup,
} from './features'
import type { CheckOptions } from './check'
import { key, stripAll } from './normalize'

export type Cell = NominalCell | VerbCell

/** A lemma reference that is unique across files: `pos:id` ("noun:λόγος"). */
export type LemmaRef = string

export interface Scope {
  dual?: boolean
  tenses?: Tense[]
  voices?: VoiceGroup[]
  moods?: Mood[]
}

/** Everything checkAnswer needs to explain a wrong answer to one cell of one lemma. */
export type CheckContext = Required<Pick<CheckOptions, 'stemLength' | 'pastTense' | 'otherForms'>> &
  Pick<CheckOptions, 'augmentAt' | 'augmentedTwins' | 'lemma'>

export interface Paradigms {
  lemmas: Lemma[]
  lemma(ref: LemmaRef): Lemma | undefined
  lemmasWhere(q: { pos?: Pos[]; classes?: LemmaClass[] }): Lemma[]
  forms(lemma: Lemma, cellKey: string): string[]
  parsesOf(lemma: Lemma, form: string): Cell[]
  blocks(lemma: Lemma): string[]
  cellsInScope(lemma: Lemma, scope: Scope): Cell[]
  /** `scope.dual`: whether dual forms are being drilled (they count as "other forms" only then). */
  checkContext(lemma: Lemma, cellKey: string, scope?: Pick<Scope, 'dual'>): CheckContext
}

export function lemmaRef(lemma: Lemma): LemmaRef {
  return `${lemma.pos}:${lemma.id}`
}

/** Letters (accent-free) shared by the start of every form: the stem for highlighting errors. */
export function stemLength(forms: string[]): number {
  const words = forms.map(stripAll)
  if (!words.length) return 0
  let n = 0
  while (words.every((w) => n < w.length && w[n] === words[0][n])) n++
  return n
}

function blockOf(cell: Cell): string | null {
  return 'tense' in cell ? cell.key.split('.').slice(0, 2).join('.') : null
}

function numberOf(cell: Cell): GNumber | undefined {
  return cell.number
}

function commonPrefixLength(a: string, b: string): number {
  let n = 0
  while (n < a.length && n < b.length && a[n] === b[n]) n++
  return n
}

/** The accent-free letters every form shares at the start. */
function sharedStart(forms: string[]): string {
  const words = forms.map(stripAll)
  return words.length ? words[0].slice(0, stemLength(forms)) : ''
}

/**
 * Stem letters for deciding "wrong ending" vs "wrong stem". Nominals: the oblique cases without
 * the dative plural (3rd-declension nominative singular and dative plural fuse stem and ending).
 * Finite verbs: the indicative cells of the same tense and voice (an aorist stem must not be
 * measured against the unaugmented infinitive). Infinitives: that indicative stem without its
 * augment.
 */
function stemFor(lemma: Lemma, cellKey: string, augmentAt: number): number {
  const cells = lemma.cells as Cell[]
  if (lemma.pos !== 'verb') {
    const oblique = cells.filter(
      (c) => 'case' in c && ['gen', 'dat', 'acc'].includes(c.case) && c.number !== 'du' && !(c.case === 'dat' && c.number === 'pl'),
    )
    return stemLength(oblique.flatMap((c) => c.forms))
  }
  const [tense, group, mood] = cellKey.split('.')
  const indicative = cells.filter((c) => c.key.startsWith(`${tense}.${group}.ind.`)).flatMap((c) => c.forms)
  const past = tense === 'impf' || tense === 'aor'
  if (mood === 'ind') {
    const n = stemLength(indicative)
    // Alternate augments (εὗρον / ηὗρον) disagree in the first letter: measure the stem after it.
    if (n < 2 && past) return 1 + stemLength(indicative.map((f) => stripAll(f).slice(1)))
    return n
  }
  const infinitive = stripAll(cells.find((c) => c.key === cellKey)?.forms[0] ?? '')
  const stem = sharedStart(indicative)
  const candidates = [stem]
  if (past) {
    candidates.push(stem.slice(1)) // syllabic augment dropped
    candidates.push(infinitive[0] + stem.slice(1)) // temporal augment: the first vowel differs
    candidates.push(stem.slice(0, augmentAt) + stem.slice(augmentAt + 1)) // augment after a preverb
  }
  const fits = candidates.filter((c) => c.length > 1 && infinitive.startsWith(c)).map((c) => c.length)
  const fromLemma = commonPrefixLength(infinitive, stripAll(lemma.lemma))
  const best = Math.max(0, ...fits, fits.length ? 0 : fromLemma)
  return best || Math.max(0, infinitive.length - 4) // nothing to measure against: endings run about 4 letters
}

// Preverbs as written in the present and before the augment (accent-free), for compound verbs:
// ἀπο-κτείνω / ἀπ-έ-κτεινον, συμ-βαίνω / συν-έ-βαινον. Longer forms first.
const PREVERBS: [string[], string[]][] = [
  [['αμφι', 'αμφ'], ['αμφ']],
  [['αντι', 'αντ', 'ανθ'], ['αντ', 'ανθ']],
  [['ανα', 'αν'], ['αν']],
  [['απο', 'απ', 'αφ'], ['απ', 'αφ']],
  [['δια', 'δι'], ['δι']],
  [['εισ'], ['εισ']],
  [['εκ', 'εξ'], ['εξ']],
  [['επι', 'επ', 'εφ'], ['επ', 'εφ']],
  [['εν', 'εμ', 'εγ'], ['εν']],
  [['κατα', 'κατ', 'καθ'], ['κατ', 'καθ']],
  [['μετα', 'μετ', 'μεθ'], ['μετ', 'μεθ']],
  [['παρα', 'παρ'], ['παρ']],
  [['περι'], ['περι']],
  [['προσ'], ['προσ']],
  [['προ'], ['προ', 'πρου']],
  [['συν', 'συμ', 'συγ', 'συλ', 'συσ', 'συ'], ['συν']],
  [['υπερ'], ['υπερ']],
  [['υπο', 'υπ', 'υφ'], ['υπ', 'υφ']],
]

/**
 * Where a verb's augment goes: after the preverb of a compound, else at the start. A preverb only
 * counts if every past form of the verb keeps it in front (so διώκω, ἐδίωκον is not δι-ώκω).
 */
function augmentPosition(lemma: Lemma): number {
  const past = (lemma.cells as Cell[])
    .filter((c) => /^(impf|aor)\.[a-z]+\.ind\.1\.sg$/.test(c.key))
    .flatMap((c) => c.forms.map(stripAll))
  if (!past.length) return 0
  const letters = stripAll(lemma.lemma)
  for (const [inPresent, beforeAugment] of PREVERBS) {
    if (!inPresent.some((p) => letters.startsWith(p) && letters.length > p.length + 1)) continue
    const kept = beforeAugment.find((b) => past.every((f) => f.startsWith(b)))
    if (kept) return kept.length
  }
  return 0
}

export function makeParadigms(files: ParadigmFile[]): Paradigms {
  const lemmas = files.flatMap((f) => f.lemmas)
  const byRef = new Map(lemmas.map((l) => [lemmaRef(l), l]))
  const cellsByKey = new Map(lemmas.map((l) => [l as Lemma, new Map<string, Cell>(l.cells.map((c: Cell) => [c.key, c]))]))
  return {
    lemmas,
    lemma: (ref) => byRef.get(ref),
    lemmasWhere: ({ pos, classes }) =>
      lemmas.filter((l) => (!pos || pos.includes(l.pos)) && (!classes || classes.includes(l.class))),
    forms: (lemma, cellKey) => cellsByKey.get(lemma)?.get(cellKey)?.forms ?? [],
    parsesOf: (lemma, form) => {
      const k = key(form)
      return (lemma.cells as Cell[]).filter((c) => c.forms.some((f) => key(f) === k))
    },
    blocks: (lemma) => [
      ...new Set((lemma.cells as Cell[]).map(blockOf).filter((b): b is string => b !== null)),
    ],
    checkContext: (lemma, cellKey, scope = {}) => {
      const [tense, group, mood, ...rest] = cellKey.split('.')
      const verb = lemma.pos === 'verb'
      const augmentAt = verb ? augmentPosition(lemma) : 0
      // The same person in the other of present / imperfect: typing it is an augment error, unless
      // the augment is invisible (ἥκω, ἧκον: the imperfect keeps the present stem).
      const presentStem = stripAll(lemma.lemma).replace(/(ω|ομαι)$/, '')
      const impfFirst = stripAll(cellsByKey.get(lemma)?.get(`impf.${group}.ind.1.sg`)?.forms[0] ?? '')
      const visible = verb && presentStem.length > 0 && !impfFirst.startsWith(presentStem)
      const other = tense === 'pres' ? 'impf' : tense === 'impf' ? 'pres' : null
      const twin = visible && other && mood === 'ind' ? [`${other}.${group}.ind`, ...rest].join('.') : null
      return {
        stemLength: stemFor(lemma, cellKey, augmentAt),
        pastTense: verb && (tense === 'impf' || tense === 'aor') && mood === 'ind',
        augmentAt: verb ? augmentAt : undefined,
        augmentedTwins: twin ? (cellsByKey.get(lemma)?.get(twin)?.forms ?? []) : [],
        lemma: lemma.lemma,
        otherForms: (lemma.cells as Cell[])
          .filter((c) => c.key !== cellKey && (scope.dual || numberOf(c) !== 'du'))
          .map((c) => ({ cell: c.key, forms: c.forms })),
      }
    },
    cellsInScope: (lemma, scope) =>
      (lemma.cells as Cell[]).filter((c) => {
        if (!scope.dual && numberOf(c) === 'du') return false
        if (!('tense' in c)) return true
        const group = c.key.split('.')[1] as VoiceGroup
        return (
          (!scope.tenses || scope.tenses.includes(c.tense)) &&
          (!scope.voices || scope.voices.includes(group)) &&
          (!scope.moods || scope.moods.includes(c.mood))
        )
      }),
  }
}

/** Load the three paradigm files. Each is a separate chunk, fetched on first use. */
export async function loadParadigms(): Promise<Paradigms> {
  const [nouns, adjectives, verbs] = await Promise.all([
    import('../../../data/paradigms/nouns.json'),
    import('../../../data/paradigms/adjectives.json'),
    import('../../../data/paradigms/verbs.json'),
  ])
  return makeParadigms([nouns.default, adjectives.default, verbs.default] as unknown as ParadigmFile[])
}
