// The learning path (docs/plans/redesign.md): units in textbook order, five lessons each, unlocked
// one after the other, and the XP the daily goal counts.

import type { Attempt } from './attempts'
import type { Paradigms } from './data'
import type { LemmaClass, Pos, Tense, VoiceGroup } from './features'
import type { NoteTopic } from './notes'
import {
  type MakePrompt,
  type ParsePrompt,
  type Rng,
  type TablePrompt,
  lemmasInScope,
  makePromptFor,
  parsePromptFor,
  tablePromptFor,
} from './prompts'
import type { Settings } from './settings'
import { localDay } from './srs'
import type { Store } from './storage'

/** Colour family of a unit on the path: early nominals, 3rd declension, adjectives, verbs. */
export type Family = 'early' | 'decl3' | 'adj' | 'verb'

export interface Unit {
  id: string
  title: string
  blurb: string
  family: Family
  note: NoteTopic
  pos: Pos[]
  classes?: LemmaClass[]
  tenses?: Tense[]
  voices?: VoiceGroup[]
}

const nominal = (pos: Pos[], classes: LemmaClass[]) => ({ pos, classes })
const verb = (tenses: Tense[], voices: VoiceGroup[]) => ({ pos: ['verb'] as Pos[], tenses, voices })

export const UNITS: Unit[] = [
  { id: 'article', title: 'The article', blurb: 'The word for “the”, in every case, number and gender.', family: 'early', note: 'article', ...nominal(['article'], ['article']) },
  { id: 'decl2', title: '2nd declension', blurb: 'Nouns in -ος and neuters in -ον.', family: 'early', note: 'decl2', ...nominal(['noun'], ['decl2-mf', 'decl2-n']) },
  { id: 'decl1f', title: '1st declension feminines', blurb: 'Nouns in -η and -α.', family: 'early', note: 'decl1', ...nominal(['noun'], ['decl1-eta', 'decl1-a-long', 'decl1-a-short']) },
  { id: 'pres-act', title: 'Present active', blurb: 'The present indicative and infinitive of ω-verbs.', family: 'verb', note: 'verb-endings', ...verb(['pres'], ['act']) },
  { id: 'adj-12', title: 'Adjectives -ος -η -ον', blurb: 'Adjectives of the 1st and 2nd declensions, and two-ending ones.', family: 'adj', note: 'adj-212', ...nominal(['adj'], ['adj-212-eta', 'adj-212-alpha', 'adj-22']) },
  { id: 'decl1m', title: '1st declension masculines', blurb: 'Masculine nouns in -ης and -ας.', family: 'early', note: 'decl1', ...nominal(['noun'], ['decl1-masc-es', 'decl1-masc-as']) },
  { id: 'impf-act', title: 'Imperfect active', blurb: 'The augment and the past endings.', family: 'verb', note: 'augment', ...verb(['impf'], ['act']) },
  { id: 'pres-mp', title: 'Middle and passive', blurb: 'The present and imperfect middle/passive.', family: 'verb', note: 'middle-passive', ...verb(['pres', 'impf'], ['mp']) },
  { id: 'fut', title: 'The future', blurb: 'Future active and middle, from the second principal part.', family: 'verb', note: 'principal-parts', ...verb(['fut'], ['act', 'mid']) },
  { id: 'decl3c', title: '3rd declension: consonant stems', blurb: 'Labial, velar, dental, ντ, liquid and nasal stems.', family: 'decl3', note: 'decl3-consonant', ...nominal(['noun'], ['decl3-labial', 'decl3-velar', 'decl3-dental', 'decl3-nt', 'decl3-liquid']) },
  { id: 'aor-act', title: 'Aorist active', blurb: 'The 1st and 2nd aorist, indicative and infinitive.', family: 'verb', note: 'aorist', ...verb(['aor'], ['act']) },
  { id: 'aor-mid', title: 'Aorist middle', blurb: 'Middle endings on the aorist stem.', family: 'verb', note: 'aorist', ...verb(['aor'], ['mid']) },
  { id: 'decl3s', title: '3rd declension: σ-stems', blurb: 'Stems in σ and their contracted endings.', family: 'decl3', note: 'decl3-s', ...nominal(['noun'], ['decl3-s']) },
  { id: 'adj3', title: '3rd declension adjectives', blurb: 'Adjectives in -ης -ες and -ων -ον.', family: 'adj', note: 'adj-3', ...nominal(['adj'], ['adj-3-es', 'adj-3-on']) },
  { id: 'decl3v', title: '3rd declension: vowel stems', blurb: 'ι-, υ- and ευ-stems.', family: 'decl3', note: 'decl3-iu', ...nominal(['noun'], ['decl3-i', 'decl3-u', 'decl3-eu']) },
  { id: 'pass', title: 'Aorist and future passive', blurb: 'The aorist passive and the future passive.', family: 'verb', note: 'middle-passive', ...verb(['aor', 'fut'], ['pass']) },
  { id: 'perf', title: 'The perfect', blurb: 'Reduplication, the perfect active and middle/passive.', family: 'verb', note: 'perfect', ...verb(['perf'], ['act', 'mp']) },
]

/** The player's settings narrowed to a unit (answer checking, dual and display stay as set). */
export function unitSettings(unit: Unit, settings: Settings): Settings {
  return {
    ...settings,
    scope: {
      pos: unit.pos,
      classes: unit.classes ?? [],
      tenses: unit.tenses ?? settings.scope.tenses,
      voices: unit.voices ?? settings.scope.voices,
      dual: settings.scope.dual,
    },
  }
}

/** Units with words in the data. */
export function unitsInData(data: Paradigms, settings: Settings): Unit[] {
  return UNITS.filter((u) => lemmasInScope(data, unitSettings(u, settings)).length > 0)
}

// ---------------------------------------------------------------------------- lessons

export type LessonKind = 'parse' | 'make' | 'mixed' | 'table' | 'test'

export interface Lesson {
  /** `unit.n`, n from 1. */
  id: string
  unit: Unit
  /** Position in the whole path. */
  index: number
  kind: LessonKind
  title: string
  /** Exercises (tables for a table lesson). */
  size: number
  /** How many of the unit's most frequent words the lesson draws on. */
  pool: number
}

const PLAN: { kind: LessonKind; title: string; size: number; pool: number }[] = [
  { kind: 'parse', title: 'Spot the form', size: 8, pool: 3 },
  { kind: 'make', title: 'Build the form', size: 8, pool: 4 },
  { kind: 'mixed', title: 'Mixed practice', size: 10, pool: 6 },
  { kind: 'table', title: 'Full table', size: 2, pool: 6 },
  { kind: 'test', title: 'Unit test', size: 12, pool: Infinity },
]

/** Share of right answers a unit test needs. */
export const PASS_MARK = 0.8

export const LESSONS: Lesson[] = UNITS.flatMap((unit, u) =>
  PLAN.map((p, i) => ({ ...p, id: `${unit.id}.${i + 1}`, unit, index: u * PLAN.length + i })),
)

export function findLesson(id: string): Lesson | undefined {
  return LESSONS.find((l) => l.id === id)
}

export function lessonsOf(unit: Unit): Lesson[] {
  return LESSONS.filter((l) => l.unit.id === unit.id)
}

export type Exercise =
  | { kind: 'parse'; prompt: ParsePrompt }
  | { kind: 'make'; prompt: MakePrompt }
  | { kind: 'table'; prompt: TablePrompt }

function pick<T>(items: T[], rng: Rng): T {
  return items[Math.floor(rng() * items.length)]
}

/** A lesson's exercises: the unit's most frequent words first, never the same item twice in a row. */
export function buildLesson(data: Paradigms, settings: Settings, lesson: Lesson, rng: Rng): Exercise[] {
  const s = unitSettings(lesson.unit, settings)
  const scope = { tenses: s.scope.tenses, voices: s.scope.voices, dual: s.scope.dual }
  const pool = lemmasInScope(data, s)
    .sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity))
    .slice(0, lesson.pool)
  if (!pool.length) return []
  if (lesson.kind === 'table') {
    return (['few', 'half'] as const).map((d) => ({ kind: 'table', prompt: tablePromptFor(data, s, pick(pool, rng), rng, d) }))
  }
  const out: Exercise[] = []
  let last = ''
  for (let i = 0; i < lesson.size; i++) {
    let lemma = pick(pool, rng)
    let cell = pick(data.cellsInScope(lemma, scope), rng)
    for (let tries = 0; tries < 10 && `${lemma.id}|${cell.key}|${lemma.pos}` === last; tries++) {
      lemma = pick(pool, rng)
      cell = pick(data.cellsInScope(lemma, scope), rng)
    }
    last = `${lemma.id}|${cell.key}|${lemma.pos}`
    const parse = lesson.kind === 'parse' || ((lesson.kind === 'mixed' || lesson.kind === 'test') && i % 2 === 0)
    out.push(parse ? { kind: 'parse', prompt: parsePromptFor(data, s, lemma, cell, rng) } : { kind: 'make', prompt: makePromptFor(data, s, lemma, cell) })
  }
  return out
}

// ---------------------------------------------------------------------------- progress

export interface LogEntry {
  lesson: string
  ts: number
  right: number
  total: number
}

export interface PathState {
  log: LogEntry[]
}

const KEY = 'path'
const MAX_LOG = 2000

export function emptyPath(): PathState {
  return { log: [] }
}

function isEntry(v: unknown): v is LogEntry {
  if (!v || typeof v !== 'object') return false
  const e = v as Record<string, unknown>
  return typeof e.lesson === 'string' && typeof e.ts === 'number' && typeof e.right === 'number' && typeof e.total === 'number'
}

export function parsePath(raw: unknown): PathState {
  const log = raw && typeof raw === 'object' && Array.isArray((raw as { log?: unknown }).log) ? (raw as { log: unknown[] }).log : []
  return { log: log.filter(isEntry) }
}

export function loadPath(store: Store): PathState {
  return parsePath(store.read<unknown>(KEY, null))
}

export function savePath(store: Store, path: PathState): void {
  store.write(KEY, path)
}

/** Whether a finished lesson counts as done (a unit test needs the pass mark). */
export function passed(lessonId: string, result: { right: number; total: number }): boolean {
  const lesson = findLesson(lessonId)
  if (!lesson || !result.total) return false
  return lesson.kind !== 'test' || result.right / result.total >= PASS_MARK
}

export function completeLesson(path: PathState, lessonId: string, result: { right: number; total: number }, ts: number): PathState {
  return { log: [...path.log, { lesson: lessonId, ts, ...result }].slice(-MAX_LOG) }
}

/** Index of the furthest lesson done; a passed unit test counts every lesson before it as done. */
function furthest(path: PathState): number {
  let max = -1
  for (const e of path.log) {
    const lesson = findLesson(e.lesson)
    if (lesson && passed(e.lesson, e) && lesson.index > max) max = lesson.index
  }
  return max
}

/** `jump`: a unit test ahead of the current lesson, which can be taken to skip there. */
export type LessonState = 'done' | 'current' | 'locked' | 'jump'

export function lessonState(path: PathState, lessonId: string): LessonState {
  const lesson = findLesson(lessonId)
  if (!lesson) return 'locked'
  const f = furthest(path)
  if (lesson.index <= f) return 'done'
  if (lesson.index === f + 1) return 'current'
  return lesson.kind === 'test' ? 'jump' : 'locked'
}

export function nextLesson(path: PathState): Lesson | undefined {
  return LESSONS[furthest(path) + 1]
}

/** How many times each lesson has been finished. */
export function timesPlayed(path: PathState): Map<string, number> {
  const out = new Map<string, number>()
  for (const e of path.log) out.set(e.lesson, (out.get(e.lesson) ?? 0) + 1)
  return out
}

// ---------------------------------------------------------------------------- XP

/** XP for finishing a lesson, on top of one per right answer. */
export const LESSON_BONUS = 10

/** XP earned on the local day of `now`: right answers in every mode, plus lesson bonuses. */
export function dailyXp(attempts: Attempt[], path: PathState, now: Date): number {
  const day = localDay(now)
  const right = attempts.filter((a) => a.correct && localDay(new Date(a.ts)) === day).length
  const lessons = path.log.filter((e) => localDay(new Date(e.ts)) === day).length
  return right + lessons * LESSON_BONUS
}

/** XP of each of the last `days` local days, oldest first. */
export function xpHistory(attempts: Attempt[], path: PathState, now: Date, days = 7): { day: Date; xp: number }[] {
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(now)
    d.setDate(d.getDate() - (days - 1 - i))
    return { day: d, xp: dailyXp(attempts, path, d) }
  })
}
