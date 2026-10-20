// Spaced repetition (SPEC §8) with FSRS (ts-fsrs). Pure functions of the state and the time, so
// scheduling can be tested with a fake clock.

import { type Card, type Grade as FsrsGrade, Rating, State, createEmptyCard, fsrs } from 'ts-fsrs'
import type { Store } from './storage'

export const Grade = { Again: Rating.Again, Hard: Rating.Hard, Good: Rating.Good } as const
export type Grade = (typeof Grade)[keyof typeof Grade]

/** A card as stored: ts-fsrs's card with its dates as ISO strings. */
export interface StoredCard {
  due: string
  stability: number
  difficulty: number
  elapsed_days: number
  scheduled_days: number
  learning_steps: number
  reps: number
  lapses: number
  state: number
  last_review?: string
  /** The grade of the last answer. */
  last_grade?: number
}

export interface SrsState {
  /** `f:<featureKey>` (class × cell) and `i:<itemKey>` (lemma × cell). */
  cards: Record<string, StoredCard>
  /** New cards Review introduced, per local day (YYYY-MM-DD). */
  introduced: Record<string, number>
}

export const EMPTY_SRS: SrsState = Object.freeze({ cards: Object.freeze({}), introduced: Object.freeze({}) }) as SrsState

const scheduler = fsrs({ enable_fuzz: false })
const KEY = 'srs'

/** Right → Good; right only because the strictness setting forgave something → Hard; wrong → Again. */
export function gradeFor(correct: boolean, forgiven: boolean): Grade {
  if (!correct) return Grade.Again
  return forgiven ? Grade.Hard : Grade.Good
}

export function localDay(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function toCard(s: StoredCard): Card {
  return {
    due: new Date(s.due),
    stability: s.stability,
    difficulty: s.difficulty,
    elapsed_days: s.elapsed_days,
    scheduled_days: s.scheduled_days,
    learning_steps: s.learning_steps,
    reps: s.reps,
    lapses: s.lapses,
    state: s.state as State,
    last_review: s.last_review ? new Date(s.last_review) : undefined,
  }
}

function fromCard(c: Card): StoredCard {
  const out: StoredCard = {
    due: c.due.toISOString(),
    stability: c.stability,
    difficulty: c.difficulty,
    elapsed_days: c.elapsed_days,
    scheduled_days: c.scheduled_days,
    learning_steps: c.learning_steps,
    reps: c.reps,
    lapses: c.lapses,
    state: c.state,
  }
  if (c.last_review) out.last_review = c.last_review.toISOString()
  return out
}

function next(stored: StoredCard | undefined, grade: Grade, now: Date): StoredCard {
  const card = stored ? toCard(stored) : createEmptyCard(now)
  return { ...fromCard(scheduler.next(card, now, grade as FsrsGrade).card), last_grade: grade }
}

/** Update the item card and its feature card after an answer. */
export function review(
  state: SrsState,
  ids: { itemKey: string; featureKey: string },
  grade: Grade,
  now: Date,
  opts: { introduced?: boolean } = {},
): SrsState {
  const item = `i:${ids.itemKey}`
  const feature = `f:${ids.featureKey}`
  const isNew = !(item in state.cards)
  const day = localDay(now)
  return {
    cards: { ...state.cards, [item]: next(state.cards[item], grade, now), [feature]: next(state.cards[feature], grade, now) },
    introduced: opts.introduced && isNew ? { ...state.introduced, [day]: (state.introduced[day] ?? 0) + 1 } : state.introduced,
  }
}

export function introducedOn(state: SrsState, now: Date): number {
  return state.introduced[localDay(now)] ?? 0
}

export function hasCard(state: SrsState, itemKey: string): boolean {
  return `i:${itemKey}` in state.cards
}

/** Item keys due by `now`, earliest first. */
export function dueItems(state: SrsState, now: Date): string[] {
  return Object.entries(state.cards)
    .filter(([id, c]) => id.startsWith('i:') && new Date(c.due) <= now)
    .sort(([, a], [, b]) => a.due.localeCompare(b.due))
    .map(([id]) => id.slice(2))
}

/** When the next item card falls due, if any. */
export function nextDue(state: SrsState): Date | null {
  const dues = Object.entries(state.cards)
    .filter(([id]) => id.startsWith('i:'))
    .map(([, c]) => c.due)
    .sort()
  return dues.length ? new Date(dues[0]) : null
}

/** Feature cells last answered wrong, being relearnt, or likely forgotten (retrievability below 0.85), weakest first. */
export function weakFeatures(state: SrsState, now: Date): string[] {
  return Object.entries(state.cards)
    .filter(([id]) => id.startsWith('f:'))
    .map(([id, c]) => ({ id, c, r: scheduler.get_retrievability(toCard(c), now, false) }))
    .filter(({ c, r }) => c.last_grade === Grade.Again || c.state === State.Relearning || r < 0.85)
    .sort((a, b) => a.r - b.r)
    .map(({ id }) => id.slice(2))
}

function isCard(v: unknown): v is StoredCard {
  if (!v || typeof v !== 'object') return false
  const c = v as Record<string, unknown>
  const numbers = ['stability', 'difficulty', 'elapsed_days', 'scheduled_days', 'learning_steps', 'reps', 'lapses', 'state']
  return (
    typeof c.due === 'string' &&
    !Number.isNaN(Date.parse(c.due)) &&
    numbers.every((k) => typeof c[k] === 'number') &&
    (c.last_review === undefined || (typeof c.last_review === 'string' && !Number.isNaN(Date.parse(c.last_review)))) &&
    (c.last_grade === undefined || typeof c.last_grade === 'number')
  )
}

export function parseSrs(raw: unknown): SrsState {
  if (!raw || typeof raw !== 'object') return EMPTY_SRS
  const r = raw as Record<string, unknown>
  const cards = r.cards && typeof r.cards === 'object' ? Object.entries(r.cards).filter(([, c]) => isCard(c)) : []
  const introduced =
    r.introduced && typeof r.introduced === 'object'
      ? Object.entries(r.introduced).filter(([day, n]) => /^\d{4}-\d{2}-\d{2}$/.test(day) && typeof n === 'number')
      : []
  return { cards: Object.fromEntries(cards) as Record<string, StoredCard>, introduced: Object.fromEntries(introduced) as Record<string, number> }
}

export function loadSrs(store: Store): SrsState {
  return parseSrs(store.read<unknown>(KEY, null))
}

export function saveSrs(store: Store, state: SrsState): void {
  store.write(KEY, state)
}
