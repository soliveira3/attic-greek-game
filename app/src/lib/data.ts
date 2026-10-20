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

export interface Paradigms {
  lemmas: Lemma[]
  lemma(ref: LemmaRef): Lemma | undefined
  lemmasWhere(q: { pos?: Pos[]; classes?: LemmaClass[] }): Lemma[]
  forms(lemma: Lemma, cellKey: string): string[]
  parsesOf(lemma: Lemma, form: string): Cell[]
  blocks(lemma: Lemma): string[]
  cellsInScope(lemma: Lemma, scope: Scope): Cell[]
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
