// Prompt generators for the practice modes (PLAN Phase 4): pure functions of the data, the
// settings and a random source, so a seed reproduces a round.

import { itemKey } from './attempts'
import { type Cell, type CheckContext, type Paradigms, type Scope, lemmaRef } from './data'
import { type Lemma, cellLabel, featureKey } from './features'
import { sameSpelling } from './normalize'
import type { Settings } from './settings'

export type Rng = () => number

/** mulberry32: a small seedable generator, values in [0, 1). */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pick<T>(items: T[], rng: Rng): T {
  return items[Math.floor(rng() * items.length)]
}

function shuffle<T>(items: T[], rng: Rng): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

function scopeOf(settings: Settings): Scope {
  const { tenses, voices, dual } = settings.scope
  return { tenses, voices, dual }
}

/** Lemmas of the chosen parts of speech and classes that have at least one cell in scope. */
export function lemmasInScope(data: Paradigms, settings: Settings): Lemma[] {
  const { pos, classes } = settings.scope
  return data
    .lemmasWhere({ pos, classes: classes.length ? classes : undefined })
    .filter((l) => data.cellsInScope(l, scopeOf(settings)).length > 0)
}

export interface Item {
  lemma: Lemma
  cell: Cell
  /** Attempt keys (attempts.ts). */
  itemKey: string
  featureKey: string
}

function item(lemma: Lemma, cell: Cell): Item {
  return { lemma, cell, itemKey: itemKey(lemmaRef(lemma), cell.key), featureKey: featureKey(lemma.class, cell.key) }
}

/** A lemma, then one of its cells in scope; `avoid` (an item key) is skipped when possible. */
export function pickCell(data: Paradigms, settings: Settings, rng: Rng, avoid?: string): Item | null {
  const lemmas = lemmasInScope(data, settings)
  if (!lemmas.length) return null
  let chosen = item(lemmas[0], data.cellsInScope(lemmas[0], scopeOf(settings))[0])
  for (let tries = 0; tries < 10; tries++) {
    const lemma = pick(lemmas, rng)
    chosen = item(lemma, pick(data.cellsInScope(lemma, scopeOf(settings)), rng))
    if (chosen.itemKey !== avoid) break
  }
  return chosen
}

export interface MakePrompt extends Item {
  /** Every valid answer. */
  forms: string[]
  context: CheckContext
  /** The target features in words ("aorist middle indicative, 3rd person plural"). */
  label: string
}

export function makePrompt(data: Paradigms, settings: Settings, rng: Rng, avoid?: string): MakePrompt | null {
  const it = pickCell(data, settings, rng, avoid)
  return it ? makePromptFor(data, settings, it.lemma, it.cell) : null
}

/** A Make it prompt for a given lemma and cell (Review). */
export function makePromptFor(data: Paradigms, settings: Settings, lemma: Lemma, cell: Cell): MakePrompt {
  return {
    ...item(lemma, cell),
    forms: data.forms(lemma, cell.key),
    context: data.checkContext(lemma, cell.key, { dual: settings.scope.dual }),
    label: cellLabel(cell.key),
  }
}

export interface ParsePrompt extends Item {
  /** The form shown. */
  form: string
  /**
   * Every cell of the lemma with that form (dual cells only when the dual is drilled; with length
   * marks shown, only cells that agree on vowel length).
   */
  parses: Cell[]
}

export function parsePrompt(data: Paradigms, settings: Settings, rng: Rng, avoid?: string): ParsePrompt | null {
  const it = pickCell(data, settings, rng, avoid)
  return it ? parsePromptFor(data, settings, it.lemma, it.cell, rng) : null
}

/** A Parse it prompt for a given lemma and cell (one of the cell's forms is shown). */
export function parsePromptFor(data: Paradigms, settings: Settings, lemma: Lemma, cell: Cell, rng: Rng): ParsePrompt {
  const it = item(lemma, cell)
  const form = pick(it.cell.forms, rng)
  // With length marks shown, a long and a short vowel make different words (fem. sg. vs neut. pl.)
  const parses = data
    .parsesOf(it.lemma, form)
    .filter((c) => settings.scope.dual || c.number !== 'du')
    .filter((c) => !settings.lengthMarks || c.forms.some((f) => sameSpelling(f, form)))
  return { ...it, form, parses }
}

export const DIFFICULTIES = ['few', 'half', 'all'] as const
export type Difficulty = (typeof DIFFICULTIES)[number]

/** How many of a table's cells are left blank. */
export function blankCount(cells: number, difficulty: Difficulty): number {
  if (difficulty === 'few') return Math.min(cells, 3)
  if (difficulty === 'half') return Math.ceil(cells / 2)
  return cells
}

export interface TablePrompt {
  lemma: Lemma
  /** The verb's tense-voice block ("aor.mid"); null for a nominal's whole paradigm. */
  block: string | null
  cells: Cell[]
  /** Keys of the cells to fill in. */
  blanks: Set<string>
  contexts: Record<string, CheckContext>
}

/** One lemma's paradigm in scope (one tense-voice block for verbs) with some cells blank. */
export function tablePrompt(data: Paradigms, settings: Settings, rng: Rng, difficulty: Difficulty): TablePrompt | null {
  const lemmas = lemmasInScope(data, settings)
  if (!lemmas.length) return null
  return tablePromptFor(data, settings, pick(lemmas, rng), rng, difficulty)
}

/** A Fill the table prompt for a given lemma. */
export function tablePromptFor(data: Paradigms, settings: Settings, lemma: Lemma, rng: Rng, difficulty: Difficulty): TablePrompt {
  let cells = data.cellsInScope(lemma, scopeOf(settings))
  let block: string | null = null
  if (lemma.pos === 'verb') {
    block = pick([...new Set(cells.map((c) => c.key.split('.').slice(0, 2).join('.')))], rng)
    cells = cells.filter((c) => c.key.startsWith(`${block}.`))
  }
  const blanks = new Set(shuffle(cells, rng).slice(0, blankCount(cells.length, difficulty)).map((c) => c.key))
  const contexts = Object.fromEntries(
    cells.map((c) => [c.key, data.checkContext(lemma, c.key, { dual: settings.scope.dual })]),
  )
  return { lemma, block, cells, blanks, contexts }
}
