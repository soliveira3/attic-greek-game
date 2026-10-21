// Fill the table (SPEC §5): one word's paradigm (one tense-voice block for a verb) with blanks.
import { useState } from 'react'
import { useApp } from '../app/AppContext'
import { EmptyScope } from '../components/EmptyScope'
import { ModeHeader } from '../components/ModeHeader'
import { TableCard } from '../components/TableCard'
import { Tally } from '../components/Tally'
import { itemKey } from '../lib/attempts'
import { lemmaRef } from '../lib/data'
import { featureKey } from '../lib/features'
import { DIFFICULTIES, type Difficulty, type Rng, type TablePrompt, tablePrompt } from '../lib/prompts'
import { answer } from '../lib/progress'
import { gradeFor } from '../lib/srs'

const DIFFICULTY_LABELS: Record<Difficulty, string> = { few: 'A few blanks', half: 'Half', all: 'All blank' }
const DIFFICULTY_KEY = 'fill.difficulty'

export function FillTable({ rng = Math.random }: { rng?: Rng }) {
  const { data, settings, store } = useApp()
  const [difficulty, setDifficulty] = useState<Difficulty>(() => {
    const saved = store.read<string>(DIFFICULTY_KEY, 'few')
    return (DIFFICULTIES as readonly string[]).includes(saved) ? (saved as Difficulty) : 'few'
  })
  const [table, setTable] = useState<TablePrompt | null>(() => tablePrompt(data, settings, rng, difficulty))
  const [turn, setTurn] = useState(0)
  const [score, setScore] = useState({ right: 0, total: 0 })

  function newTable(d: Difficulty = difficulty) {
    setTable(tablePrompt(data, settings, rng, d))
    setTurn((t) => t + 1)
  }

  if (!table) {
    return (
      <div className="page">
        <ModeHeader title="Fill the table" />
        <EmptyScope />
      </div>
    )
  }

  return (
    <div className="page fill-table play wide">
      <ModeHeader title="Fill the table">
        <Tally {...score} />
      </ModeHeader>
      <fieldset className="difficulty segmented">
        <legend>Blanks</legend>
        {DIFFICULTIES.map((d) => (
          <label key={d}>
            <input
              type="radio"
              name="difficulty"
              checked={difficulty === d}
              onChange={() => {
                setDifficulty(d)
                store.write(DIFFICULTY_KEY, d)
                newTable(d)
              }}
            />
            <span>{DIFFICULTY_LABELS[d]}</span>
          </label>
        ))}
      </fieldset>
      <TableCard
        key={turn}
        table={table}
        onChecked={(results) => {
          for (const [key, r] of results) {
            answer(
              store,
              {
                itemKey: itemKey(lemmaRef(table.lemma), key),
                featureKey: featureKey(table.lemma.class, key),
                correct: r.correct,
                errorKind: r.errorKind,
                ts: Date.now(),
                mode: 'fill',
              },
              gradeFor(r.correct, !r.exact),
            )
          }
          const right = results.filter(([, r]) => r.correct).length
          setScore((s) => ({ right: s.right + right, total: s.total + results.length }))
        }}
        onNext={() => newTable()}
      />
    </div>
  )
}
