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
  Pick<CheckOptions, 'augmentAt'>

export interface Paradigms {
  lemmas: Lemma[]
  lemma(ref: LemmaRef): Lemma | undefined
  lemmasWhere(q: { pos?: Pos[]; classes?: LemmaClass[] }): Lemma[]
  forms(lemma: Lemma, cellKey: string): string[]
  parsesOf(lemma: Lemma, form: string): Cell[]
  blocks(lemma: Lemma): string[]
  cellsInScope(lemma: Lemma, scope: Scope): Cell[]
  checkContext(lemma: Lemma, cellKey: string): CheckContext
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

// Infinitives that share a stem, so the stem of one infinitive can be measured against another.
const INFINITIVE_STEMS = [
  ['pres.act', 'pres.mp', 'pres.mid'],
  ['fut.act', 'fut.mid'],
  ['aor.act', 'aor.mid'],
  ['fut.pass', 'aor.pass'],
  ['perf.act', 'perf.mp'],
]

function commonPrefixLength(a: string, b: string): number {
  let n = 0
  while (n < a.length && n < b.length && a[n] === b[n]) n++
  return n
}

/**
 * Stem letters for deciding "wrong ending" vs "wrong stem". Nominals: the oblique cases without
 * the dative plural (3rd-declension nominative singular and dative plural fuse stem and ending).
 * Finite verbs: the indicative cells of the same tense and voice (an aorist stem must not be
 * measured against the unaugmented infinitive). Infinitives: the infinitives sharing their stem.
 */
function stemFor(lemma: Lemma, cellKey: string): number {
  const cells = lemma.cells as Cell[]
  if (lemma.pos !== 'verb') {
    const oblique = cells.filter(
      (c) => 'case' in c && ['gen', 'dat', 'acc'].includes(c.case) && c.number !== 'du' && !(c.case === 'dat' && c.number === 'pl'),
    )
    return stemLength(oblique.flatMap((c) => c.forms))
  }
  const [tense, group, mood] = cellKey.split('.')
  if (mood === 'ind') {
    const forms = cells.filter((c) => c.key.startsWith(`${tense}.${group}.ind.`)).flatMap((c) => c.forms)
    const n = stemLength(forms)
    // Alternate augments (εὗρον / ηὗρον) disagree in the first letter: measure the stem after it.
    if (n < 2 && (tense === 'impf' || tense === 'aor')) return 1 + stemLength(forms.map((f) => stripAll(f).slice(1)))
    return n
  }
  const partners = INFINITIVE_STEMS.find((g) => g.includes(`${tense}.${group}`)) ?? [`${tense}.${group}`]
  const forms = cells.filter((c) => partners.some((b) => c.key === `${b}.inf`)).flatMap((c) => c.forms)
  if (forms.length > 1) return stemLength(forms)
  return Math.max(0, stripAll(forms[0] ?? '').length - 4) // a lone infinitive: its ending is about 4 letters
}

/** Where a verb's augment goes: 0, or after a compound's preverb (from the verb's own past forms). */
function augmentPosition(lemma: Lemma): number {
  const past = (lemma.cells as Cell[])
    .filter((c) => /^(impf|aor)\.[a-z]+\.ind\.1\.sg$/.test(c.key))
    .flatMap((c) => c.forms)
  if (!past.length) return 0
  const lemmaLetters = stripAll(lemma.lemma)
  const shared = Math.min(...past.map((f) => commonPrefixLength(stripAll(f), lemmaLetters)))
  return shared >= 2 ? shared : 0
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
    checkContext: (lemma, cellKey) => {
      const [tense, , mood] = cellKey.split('.')
      return {
        stemLength: stemFor(lemma, cellKey),
        pastTense: lemma.pos === 'verb' && (tense === 'impf' || tense === 'aor') && mood === 'ind',
        augmentAt: lemma.pos === 'verb' ? augmentPosition(lemma) : undefined,
        otherForms: (lemma.cells as Cell[]).filter((c) => c.key !== cellKey).map((c) => ({ cell: c.key, forms: c.forms })),
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
