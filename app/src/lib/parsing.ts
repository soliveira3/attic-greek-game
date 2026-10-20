// Parse it (SPEC §5): which features the player picks for a word, and how a pick compares with
// the valid parses of the form shown.

import type { ParseSelection } from './check'
import type { Cell } from './data'
import {
  CASES,
  CASE_LABELS,
  GENDERS,
  GENDER_LABELS,
  type Lemma,
  MOODS,
  MOOD_LABELS,
  NUMBERS,
  NUMBER_LABELS,
  PERSONS,
  PERSON_LABELS,
  TENSES,
  TENSE_LABELS,
  VOICES,
  VOICE_GROUP_LABELS,
} from './features'

export type Feature = 'case' | 'number' | 'gender' | 'tense' | 'voice' | 'mood' | 'person'
export type Picks = Partial<Record<Feature, string>>

export interface Group {
  id: Feature
  label: string
  options: { value: string; label: string }[]
}

const LABELS: Record<Feature, Record<string, [string, string]>> = {
  case: CASE_LABELS,
  number: NUMBER_LABELS,
  gender: GENDER_LABELS,
  tense: TENSE_LABELS,
  voice: VOICE_GROUP_LABELS,
  mood: MOOD_LABELS,
  person: PERSON_LABELS,
}
const ORDER: Record<Feature, readonly string[]> = {
  case: CASES,
  number: NUMBERS,
  gender: GENDERS,
  tense: TENSES,
  voice: VOICES,
  mood: MOODS,
  person: PERSONS,
}
const TITLES: Record<Feature, string> = {
  case: 'Case',
  number: 'Number',
  gender: 'Gender',
  tense: 'Tense',
  voice: 'Voice',
  mood: 'Mood',
  person: 'Person',
}

/** The values of `feature` that occur among the word's cells (dual only when drilled). */
function valuesOf(lemma: Lemma, feature: Feature, dual: boolean): string[] {
  const present = new Set<string>()
  for (const cell of lemma.cells as Cell[]) {
    const v = (cell as unknown as Record<string, unknown>)[feature]
    for (const x of Array.isArray(v) ? v : [v]) if (typeof x === 'string') present.add(x)
  }
  return ORDER[feature].filter((v) => present.has(v) && (dual || v !== 'du'))
}

/** The button groups for a word: nouns show their gender, so only adjectives and the article ask it. */
export function parseGroups(lemma: Lemma, opts: { dual: boolean }): Group[] {
  const ids: Feature[] =
    lemma.pos === 'verb' ? ['tense', 'voice', 'mood', 'person', 'number'] : lemma.pos === 'noun' ? ['case', 'number'] : ['case', 'number', 'gender']
  return ids.map((id) => ({
    id,
    label: TITLES[id],
    options: valuesOf(lemma, id, opts.dual).map((value) => ({ value, label: LABELS[id][value][0] })),
  }))
}

/** An infinitive has no person or number. */
export function skipped(feature: Feature, picks: Picks): boolean {
  return picks.mood === 'inf' && (feature === 'person' || feature === 'number')
}

export function isComplete(groups: Group[], picks: Picks): boolean {
  return groups.every((g) => skipped(g.id, picks) || picks[g.id] !== undefined)
}

export function selectionOf(lemma: Lemma, picks: Picks): ParseSelection {
  if (lemma.pos === 'verb') {
    const base = { tense: picks.tense, voice: picks.voice, mood: picks.mood }
    return (picks.mood === 'inf' ? base : { ...base, person: picks.person, number: picks.number }) as ParseSelection
  }
  return (lemma.pos === 'noun' ? { case: picks.case, number: picks.number } : { case: picks.case, number: picks.number, gender: picks.gender }) as ParseSelection
}

/** The selection in words, feature by feature. */
export function selectionWords(selection: ParseSelection): { feature: Feature; text: string }[] {
  return (Object.entries(selection) as [Feature, string | undefined][])
    .filter((e): e is [Feature, string] => e[1] !== undefined)
    .map(([feature, value]) => ({ feature, text: LABELS[feature][value][0] }))
}

/** The valid parse closest to the selection, and the selected features that differ from it. */
export function nearestParse(selection: ParseSelection, parses: Cell[]): { parse: Cell; wrong: Set<Feature> } {
  const scored = parses.map((parse) => {
    const wrong = new Set<Feature>()
    for (const [feature, value] of Object.entries(selection) as [Feature, string | undefined][]) {
      const actual = (parse as unknown as Record<string, unknown>)[feature]
      const ok = Array.isArray(actual) ? actual.includes(value) : actual === value || (feature === 'gender' && actual === undefined)
      if (!ok) wrong.add(feature)
    }
    return { parse, wrong }
  })
  return scored.reduce((best, s) => (s.wrong.size < best.wrong.size ? s : best))
}
