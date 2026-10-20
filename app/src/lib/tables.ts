// How a paradigm is laid out as a grid for Fill the table (SPEC §5).

import type { Cell } from './data'
import {
  CASES,
  CASE_LABELS,
  GENDERS,
  GENDER_LABELS,
  type Lemma,
  NUMBERS,
  NUMBER_LABELS,
  PERSONS,
} from './features'

export interface TableSection {
  /** "singular" for an adjective's singular block; null when there is one section. */
  title: string | null
  columns: string[]
  rows: { label: string; keys: (string | null)[] }[]
}

export interface TableLayout {
  sections: TableSection[]
}

const ORDINAL = { '1': '1st', '2': '2nd', '3': '3rd' } as const

export function tableLayout(lemma: Lemma, cells: Cell[]): TableLayout {
  const has = new Set(cells.map((c) => c.key))
  const cellKey = (k: string) => (has.has(k) ? k : null)
  const used = <T extends string>(order: readonly T[], pick: (c: Cell) => string | undefined) =>
    order.filter((v) => cells.some((c) => pick(c) === v))

  if (lemma.pos === 'verb') {
    const [tense, group] = cells[0].key.split('.')
    const block = `${tense}.${group}`
    const rows = used(NUMBERS, (c) => c.number).flatMap((n) =>
      PERSONS.map((p) => ({ label: `${ORDINAL[p]} ${NUMBER_LABELS[n][1]}`, keys: [cellKey(`${block}.ind.${p}.${n}`)] })),
    )
    const all = has.has(`${block}.inf`) ? [...rows, { label: 'infinitive', keys: [`${block}.inf`] }] : rows
    return { sections: [{ title: null, columns: ['form'], rows: all.filter((r) => r.keys[0] !== null) }] }
  }

  const nominal = cells.filter((c): c is Extract<Cell, { case: string }> => 'case' in c)
  const cases = used(CASES, (c) => ('case' in c ? c.case : undefined))
  const numbers = used(NUMBERS, (c) => c.number)
  if (lemma.pos === 'noun') {
    return {
      sections: [
        {
          title: null,
          columns: numbers.map((n) => NUMBER_LABELS[n][0]),
          rows: cases.map((c) => ({ label: CASE_LABELS[c][0], keys: numbers.map((n) => cellKey(`${c}.${n}`)) })),
        },
      ],
    }
  }
  const genders = GENDERS.filter((g) => nominal.some((c) => c.gender === g))
  return {
    sections: numbers.map((n) => ({
      title: NUMBER_LABELS[n][0],
      columns: genders.map((g) => GENDER_LABELS[g][0]),
      rows: cases
        .map((c) => ({ label: CASE_LABELS[c][0], keys: genders.map((g) => cellKey(`${c}.${n}.${g}`)) }))
        .filter((r) => r.keys.some((k) => k !== null)),
    })),
  }
}
