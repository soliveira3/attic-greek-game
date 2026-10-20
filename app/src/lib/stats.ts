// Statistics for the Stats page (SPEC §8): day streak, accuracy per feature cell, items due today,
// and heat-map layouts of each class's paradigm.

import type { Attempt } from './attempts'
import type { Cell, Paradigms } from './data'
import { type LemmaClass, NUMBERS, NUMBER_LABELS, PERSONS, TENSES, VOICE_GROUPS, blockLabel } from './features'
import { type SrsState, localDay } from './srs'
import { type TableLayout, tableLayout } from './tables'

/** Consecutive local days with at least one answer, counting back from today (or from yesterday). */
export function streak(attempts: Attempt[], now: Date): number {
  const days = new Set(attempts.map((a) => localDay(new Date(a.ts))))
  const day = new Date(now)
  if (!days.has(localDay(day))) day.setDate(day.getDate() - 1)
  let n = 0
  while (days.has(localDay(day))) {
    n++
    day.setDate(day.getDate() - 1)
  }
  return n
}

export function accuracyByFeature(attempts: Attempt[]): Map<string, { right: number; total: number }> {
  const out = new Map<string, { right: number; total: number }>()
  for (const a of attempts) {
    const s = out.get(a.featureKey) ?? { right: 0, total: 0 }
    out.set(a.featureKey, { right: s.right + (a.correct ? 1 : 0), total: s.total + 1 })
  }
  return out
}

/** Item cards due by the end of the local day. */
export function dueToday(srs: SrsState, now: Date): number {
  const end = new Date(now)
  end.setHours(23, 59, 59, 999)
  return Object.entries(srs.cards).filter(([id, c]) => id.startsWith('i:') && new Date(c.due) <= end).length
}

const ORDINAL = { '1': '1st', '2': '2nd', '3': '3rd' } as const

/** A class's feature cells as a grid: a nominal class like its first word; verbs as tense-voice rows by person and number. */
export function heatLayout(cls: LemmaClass, data: Paradigms, dual: boolean): TableLayout {
  const lemmas = data.lemmasWhere({ classes: [cls] })
  if (!cls.startsWith('verb')) return tableLayout(lemmas[0], data.cellsInScope(lemmas[0], { dual }))
  const keys = new Set(lemmas.flatMap((l) => data.cellsInScope(l, { dual }).map((c: Cell) => c.key)))
  const blocks = TENSES.flatMap((t) => VOICE_GROUPS.map((v) => `${t}.${v}`)).filter((b) => [...keys].some((k) => k.startsWith(`${b}.`)))
  const numbers = NUMBERS.filter((n) => [...keys].some((k) => k.endsWith(`.${n}`)))
  const at = (k: string) => (keys.has(k) ? k : null)
  const slots = [
    ...numbers.flatMap((n) => PERSONS.map((p) => ({ label: `${ORDINAL[p]} ${NUMBER_LABELS[n][1]}`, suffix: `ind.${p}.${n}` }))),
    { label: 'inf.', suffix: 'inf' },
  ]
  return {
    sections: [
      {
        title: null,
        columns: slots.map((s) => s.label),
        rows: blocks.map((b) => ({ label: blockLabel(b), keys: slots.map((s) => at(`${b}.${s.suffix}`)) })),
      },
    ],
  }
}
