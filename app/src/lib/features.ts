// The feature schema: single source of truth for feature keys and data shapes.
// pipeline/schema.json mirrors these enums (features.test.ts keeps them in sync).

export const POS = ['noun', 'adj', 'article', 'verb'] as const
export const CASES = ['nom', 'gen', 'dat', 'acc', 'voc'] as const
export const NUMBERS = ['sg', 'du', 'pl'] as const
export const GENDERS = ['m', 'f', 'n'] as const
export const TENSES = ['pres', 'impf', 'fut', 'aor', 'perf'] as const
export const VOICES = ['act', 'mid', 'pass'] as const
/** A tense-voice block; `mp` is a block whose forms are both middle and passive. */
export const VOICE_GROUPS = ['act', 'mid', 'pass', 'mp'] as const
export const MOODS = ['ind', 'inf'] as const
export const PERSONS = ['1', '2', '3'] as const
export const AORIST_TYPES = ['1', '2'] as const

export const NOUN_CLASSES = [
  'decl1-a-long',
  'decl1-a-short',
  'decl1-eta',
  'decl1-masc-es',
  'decl1-masc-as',
  'decl2-mf',
  'decl2-n',
  'decl3-labial',
  'decl3-velar',
  'decl3-dental',
  'decl3-nt',
  'decl3-liquid',
  'decl3-s',
  'decl3-i',
  'decl3-u',
  'decl3-eu',
] as const
export const ADJ_CLASSES = ['adj-212-eta', 'adj-212-alpha', 'adj-22', 'adj-3-es', 'adj-3-on'] as const
export const VERB_CLASSES = ['verb-thematic'] as const

export type Pos = (typeof POS)[number]
export type Case = (typeof CASES)[number]
export type GNumber = (typeof NUMBERS)[number]
export type Gender = (typeof GENDERS)[number]
export type Tense = (typeof TENSES)[number]
export type Voice = (typeof VOICES)[number]
export type VoiceGroup = (typeof VOICE_GROUPS)[number]
export type Mood = (typeof MOODS)[number]
export type Person = (typeof PERSONS)[number]
export type AoristType = (typeof AORIST_TYPES)[number]
export type NounClass = (typeof NOUN_CLASSES)[number]
export type AdjClass = (typeof ADJ_CLASSES)[number]
export type VerbClass = (typeof VERB_CLASSES)[number]
export type LemmaClass = 'article' | NounClass | AdjClass | VerbClass

export interface NominalCell {
  /** `case.number` for nouns, `case.number.gender` for adjectives and the article. */
  key: string
  case: Case
  number: GNumber
  gender?: Gender
  forms: string[]
}

export interface VerbCell {
  /** `tense.voiceGroup.ind.person.number` or `tense.voiceGroup.inf`. */
  key: string
  tense: Tense
  voice: Voice[]
  mood: Mood
  person?: Person
  number?: GNumber
  forms: string[]
}

interface LemmaBase {
  id: string
  lemma: string
  /** The DCC headword when the Attic entry differs from it (θάλασσα → θάλαττα); null for extras. */
  dccLemma: string | null
  gloss: string
  rank: number | null
}

export interface NounLemma extends LemmaBase {
  pos: 'noun'
  class: NounClass
  gender: Gender[]
  cells: NominalCell[]
}

export interface AdjLemma extends LemmaBase {
  pos: 'adj' | 'article'
  class: AdjClass | 'article'
  cells: NominalCell[]
}

export interface VerbLemma extends LemmaBase {
  pos: 'verb'
  class: VerbClass
  aoristType: AoristType[]
  cells: VerbCell[]
}

export type Lemma = NounLemma | AdjLemma | VerbLemma

export interface ParadigmFile<L extends Lemma = Lemma> {
  schemaVersion: 1
  source: { kaikki: string; wiktionary: string; dcc: string }
  lemmas: L[]
}
