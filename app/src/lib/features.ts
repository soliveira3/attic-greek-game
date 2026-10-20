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

// ---------------------------------------------------------------------------- cell keys

export type NominalFeatures = Omit<NominalCell, 'key' | 'forms'>
export type VerbFeatures = Omit<VerbCell, 'key' | 'forms'>
export type CellFeatures = NominalFeatures | VerbFeatures

const has = <T extends string>(list: readonly T[], value: string): value is T =>
  (list as readonly string[]).includes(value)

function voicesOf(group: VoiceGroup): Voice[] {
  return group === 'mp' ? ['mid', 'pass'] : [group]
}

function groupOf(voices: readonly Voice[]): VoiceGroup {
  return voices.length === 2 ? 'mp' : voices[0]
}

/** Features of a cell key: `case.number[.gender]` or `tense.voiceGroup.(inf|ind.person.number)`. */
export function parseCellKey(key: string): CellFeatures {
  const p = key.split('.')
  if (has(TENSES, p[0])) {
    const [tense, group, mood, person, number] = p
    if (!has(VOICE_GROUPS, group) || !has(MOODS, mood)) throw new Error(`bad cell key ${key}`)
    if (mood === 'inf' && p.length === 3) return { tense, voice: voicesOf(group), mood }
    if (mood === 'ind' && p.length === 5 && has(PERSONS, person) && has(NUMBERS, number)) {
      return { tense, voice: voicesOf(group), mood, person, number }
    }
    throw new Error(`bad cell key ${key}`)
  }
  const [c, number, gender] = p
  if (has(CASES, c) && has(NUMBERS, number) && p.length === 2) return { case: c, number }
  if (has(CASES, c) && has(NUMBERS, number) && p.length === 3 && has(GENDERS, gender)) {
    return { case: c, number, gender }
  }
  throw new Error(`bad cell key ${key}`)
}

export function isVerbFeatures(f: CellFeatures): f is VerbFeatures {
  return 'tense' in f
}

export function cellKey(f: CellFeatures): string {
  if (isVerbFeatures(f)) {
    const head = `${f.tense}.${groupOf(f.voice)}`
    return f.mood === 'inf' ? `${head}.inf` : `${head}.ind.${f.person}.${f.number}`
  }
  return `${f.case}.${f.number}` + (f.gender ? `.${f.gender}` : '')
}

/** Paradigm order, as in pipeline/build_paradigms.py: verbs by tense, voice, mood, number,
 * person; nominals by gender, number, case. */
export function compareCellKeys(a: string, b: string): number {
  const rank = (key: string): number[] => {
    const f = parseCellKey(key)
    if (isVerbFeatures(f)) {
      return [
        TENSES.indexOf(f.tense),
        VOICE_GROUPS.indexOf(groupOf(f.voice)),
        f.mood === 'ind' ? 0 : 1,
        f.number ? NUMBERS.indexOf(f.number) : 0,
        f.person ? PERSONS.indexOf(f.person) : 0,
      ]
    }
    return [f.gender ? GENDERS.indexOf(f.gender) : 0, NUMBERS.indexOf(f.number), CASES.indexOf(f.case)]
  }
  const ra = rank(a)
  const rb = rank(b)
  for (let i = 0; i < Math.max(ra.length, rb.length); i++) {
    if ((ra[i] ?? -1) !== (rb[i] ?? -1)) return (ra[i] ?? -1) - (rb[i] ?? -1)
  }
  return 0
}

// ---------------------------------------------------------------------------- labels

export const CASE_LABELS: Record<Case, [string, string]> = {
  nom: ['nominative', 'nom.'],
  gen: ['genitive', 'gen.'],
  dat: ['dative', 'dat.'],
  acc: ['accusative', 'acc.'],
  voc: ['vocative', 'voc.'],
}
export const NUMBER_LABELS: Record<GNumber, [string, string]> = {
  sg: ['singular', 'sg.'],
  du: ['dual', 'du.'],
  pl: ['plural', 'pl.'],
}
export const GENDER_LABELS: Record<Gender, [string, string]> = {
  m: ['masculine', 'm.'],
  f: ['feminine', 'f.'],
  n: ['neuter', 'n.'],
}
export const TENSE_LABELS: Record<Tense, [string, string]> = {
  pres: ['present', 'pres.'],
  impf: ['imperfect', 'impf.'],
  fut: ['future', 'fut.'],
  aor: ['aorist', 'aor.'],
  perf: ['perfect', 'perf.'],
}
export const VOICE_GROUP_LABELS: Record<VoiceGroup, [string, string]> = {
  act: ['active', 'act.'],
  mid: ['middle', 'mid.'],
  pass: ['passive', 'pass.'],
  mp: ['middle/passive', 'm/p'],
}
export const MOOD_LABELS: Record<Mood, [string, string]> = {
  ind: ['indicative', 'ind.'],
  inf: ['infinitive', 'inf.'],
}
export const PERSON_LABELS: Record<Person, [string, string]> = {
  '1': ['1st person', '1'],
  '2': ['2nd person', '2'],
  '3': ['3rd person', '3'],
}
const ORDINAL: Record<Person, string> = { '1': '1st', '2': '2nd', '3': '3rd' }

export function cellLabel(key: string, opts: { short?: boolean } = {}): string {
  const i = opts.short ? 1 : 0
  const f = parseCellKey(key)
  if (isVerbFeatures(f)) {
    const head = `${TENSE_LABELS[f.tense][i]} ${VOICE_GROUP_LABELS[groupOf(f.voice)][i]}`
    if (f.mood === 'inf') return `${head} ${opts.short ? 'inf.' : 'infinitive'}`
    const pn = opts.short
      ? `${f.person} ${NUMBER_LABELS[f.number!][1]}`
      : `${ORDINAL[f.person!]} person ${NUMBER_LABELS[f.number!][0]}`
    return opts.short ? `${head} ${pn}` : `${head} indicative, ${pn}`
  }
  const parts = [CASE_LABELS[f.case][i], NUMBER_LABELS[f.number][i]]
  if (f.gender) parts.push(GENDER_LABELS[f.gender][i])
  return parts.join(' ')
}

/** "aorist passive" for the block key "aor.pass". */
export function blockLabel(block: string): string {
  const [tense, group] = block.split('.')
  if (!has(TENSES, tense) || !has(VOICE_GROUPS, group)) throw new Error(`bad block ${block}`)
  return `${TENSE_LABELS[tense][0]} ${VOICE_GROUP_LABELS[group][0]}`
}

export const CLASS_LABELS: Record<LemmaClass, string> = {
  article: 'the article',
  'decl1-a-long': '1st declension, feminine in long α',
  'decl1-a-short': '1st declension, feminine in short α',
  'decl1-eta': '1st declension, feminine in η',
  'decl1-masc-es': '1st declension, masculine in -ης',
  'decl1-masc-as': '1st declension, masculine in -ας',
  'decl2-mf': '2nd declension, masculine/feminine in -ος',
  'decl2-n': '2nd declension, neuter in -ον',
  'decl3-labial': '3rd declension, labial stems',
  'decl3-velar': '3rd declension, velar stems',
  'decl3-dental': '3rd declension, dental stems',
  'decl3-nt': '3rd declension, ντ-stems',
  'decl3-liquid': '3rd declension, liquid and nasal stems',
  'decl3-s': '3rd declension, σ-stems',
  'decl3-i': '3rd declension, ι-stems',
  'decl3-u': '3rd declension, υ-stems',
  'decl3-eu': '3rd declension, ευ-stems',
  'adj-212-eta': 'adjectives -ος -η -ον',
  'adj-212-alpha': 'adjectives -ος -α -ον',
  'adj-22': 'two-ending adjectives -ος -ον',
  'adj-3-es': '3rd declension adjectives -ης -ες',
  'adj-3-on': '3rd declension adjectives -ων -ον',
  'verb-thematic': 'thematic ω-verbs',
}

export function classLabel(cls: LemmaClass): string {
  return CLASS_LABELS[cls]
}

export const CLASS_FAMILIES: Record<string, LemmaClass[]> = {
  'The article': ['article'],
  '1st declension': NOUN_CLASSES.filter((c) => c.startsWith('decl1')),
  '2nd declension': NOUN_CLASSES.filter((c) => c.startsWith('decl2')),
  '3rd declension': NOUN_CLASSES.filter((c) => c.startsWith('decl3')),
  Adjectives: [...ADJ_CLASSES],
  Verbs: [...VERB_CLASSES],
}

// ---------------------------------------------------------------------------- review units

/** A feature cell within a class ("1st decl. fem. η · gen. pl."): the unit spaced repetition tracks. */
export function featureKey(cls: LemmaClass, cell: string): string {
  return `${cls}:${cell}`
}

export function parseFeatureKey(k: string): { cls: LemmaClass; cell: string } {
  const [cls, cell] = k.split(':')
  return { cls: cls as LemmaClass, cell }
}
