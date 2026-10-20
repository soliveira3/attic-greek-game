// Which grammar note (data/grammar/, Phase 6) explains a feature cell or a kind of mistake.

import type { ErrorKind } from './check'
import type { LemmaClass } from './features'

export const NOTE_TOPICS = [
  'article',
  'decl1',
  'decl2',
  'decl3-consonant',
  'decl3-s',
  'decl3-iu',
  'decl3-eu',
  'adj-212',
  'adj-22',
  'adj-3',
  'verb-endings',
  'augment',
  'principal-parts',
  'aorist',
  'perfect',
  'middle-passive',
  'infinitives',
  'accent',
] as const
export type NoteTopic = (typeof NOTE_TOPICS)[number]

export const NOTE_TITLES: Record<NoteTopic, string> = {
  article: 'The article',
  decl1: 'The 1st declension',
  decl2: 'The 2nd declension',
  'decl3-consonant': '3rd declension: consonant stems',
  'decl3-s': '3rd declension: σ-stems',
  'decl3-iu': '3rd declension: ι- and υ-stems',
  'decl3-eu': '3rd declension: ευ-stems',
  'adj-212': 'Adjectives of the 1st and 2nd declensions',
  'adj-22': 'Two-ending adjectives',
  'adj-3': 'Adjectives of the 3rd declension',
  'verb-endings': 'Thematic verb endings',
  augment: 'The augment',
  'principal-parts': 'Tense stems and principal parts',
  aorist: 'The 1st and 2nd aorist',
  perfect: 'The perfect',
  'middle-passive': 'Middle and passive',
  infinitives: 'Infinitives',
  accent: 'Accents and breathings',
}

export function isNoteTopic(s: string): s is NoteTopic {
  return (NOTE_TOPICS as readonly string[]).includes(s)
}

/** The note on a class as a whole. */
export function classTopic(cls: LemmaClass): NoteTopic {
  if (cls === 'article') return 'article'
  if (cls.startsWith('decl1')) return 'decl1'
  if (cls.startsWith('decl2')) return 'decl2'
  if (cls === 'decl3-s') return 'decl3-s'
  if (cls === 'decl3-i' || cls === 'decl3-u') return 'decl3-iu'
  if (cls === 'decl3-eu') return 'decl3-eu'
  if (cls.startsWith('decl3')) return 'decl3-consonant'
  if (cls.startsWith('adj-212')) return 'adj-212'
  if (cls === 'adj-22') return 'adj-22'
  if (cls.startsWith('adj-3')) return 'adj-3'
  return 'verb-endings'
}

/** The note to read after an answer to `cell` of a word of class `cls` (wrong by `errorKind`). */
export function topicFor(cls: LemmaClass, cell: string, errorKind: ErrorKind | null): NoteTopic {
  if (errorKind === 'accent' || errorKind === 'breathing') return 'accent'
  if (!cls.startsWith('verb')) return classTopic(cls)
  if (errorKind === 'augment') return 'augment'
  if (errorKind === 'stem') return 'principal-parts'
  const [tense, group, mood] = cell.split('.')
  if (mood === 'inf') return 'infinitives'
  if (group === 'pass') return 'middle-passive'
  if (tense === 'aor') return 'aorist'
  if (tense === 'perf') return 'perfect'
  if (group === 'mp' || group === 'mid') return 'middle-passive'
  return 'verb-endings'
}
