// Fill the table (SPEC §5): one word's paradigm (one tense-voice block for a verb) with blanks.
// Tab moves between blanks, Enter checks the whole table, Enter again brings a new one.

import { useEffect, useRef, useState } from 'react'
import { useApp } from '../app/AppContext'
import { useKeys } from '../app/useKeys'
import { EmptyScope } from '../components/EmptyScope'
import { Diff, NoteLink } from '../components/Feedback'
import { GreekInput } from '../components/GreekInput'
import { GreekKeyboard } from '../components/GreekKeyboard'
import { LemmaLine } from '../components/LemmaLine'
import { Tally } from '../components/Tally'
import { TypingHint } from '../components/TypingHint'
import { itemKey, recordAttempt } from '../lib/attempts'
import { type CheckResult, checkAnswer } from '../lib/check'
import { lemmaRef } from '../lib/data'
import { blockLabel, cellLabel, classLabel, featureKey } from '../lib/features'
import { listWords } from '../lib/feedback'
import { displayForm } from '../lib/normalize'
import { classTopic, topicFor } from '../lib/notes'
import { DIFFICULTIES, type Difficulty, type Rng, type TablePrompt, tablePrompt } from '../lib/prompts'
import { tableLayout } from '../lib/tables'

const DIFFICULTY_LABELS: Record<Difficulty, string> = { few: 'A few blanks', half: 'Half', all: 'All blank' }
const DIFFICULTY_KEY = 'fill.difficulty'

export function FillTable({ rng = Math.random }: { rng?: Rng }) {
  const { data, settings, store } = useApp()
  const [difficulty, setDifficulty] = useState<Difficulty>(() => {
    const saved = store.read<string>(DIFFICULTY_KEY, 'few')
    return (DIFFICULTIES as readonly string[]).includes(saved) ? (saved as Difficulty) : 'few'
  })
  const [table, setTable] = useState<TablePrompt | null>(() => tablePrompt(data, settings, rng, difficulty))
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [results, setResults] = useState<Record<string, CheckResult> | null>(null)
  const [score, setScore] = useState({ right: 0, total: 0 })
  const first = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    first.current?.focus()
  }, [table])

  function newTable(d: Difficulty = difficulty) {
    setTable(tablePrompt(data, settings, rng, d))
    setAnswers({})
    setResults(null)
  }

  function check() {
    if (!table || results) return
    const out: Record<string, CheckResult> = {}
    const order = tableLayout(table.lemma, table.cells).sections.flatMap((s) => s.rows.flatMap((r) => r.keys))
    for (const key of order) {
      if (!key || !table.blanks.has(key)) continue
      const cell = table.cells.find((c) => c.key === key)!
      const r = checkAnswer(answers[key] ?? '', cell.forms, settings.strictness, table.contexts[key])
      out[key] = r
      recordAttempt(store, {
        itemKey: itemKey(lemmaRef(table.lemma), key),
        featureKey: featureKey(table.lemma.class, key),
        correct: r.correct,
        errorKind: r.errorKind,
        ts: Date.now(),
        mode: 'fill',
      })
    }
    const right = Object.values(out).filter((r) => r.correct).length
    setScore((s) => ({ right: s.right + right, total: s.total + Object.keys(out).length }))
    setResults(out)
  }

  const onEnter = () => (results ? newTable() : check())
  useKeys((e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      onEnter()
    }
  })

  if (!table) {
    return (
      <div className="page">
        <h1 tabIndex={-1}>Fill the table</h1>
        <EmptyScope />
      </div>
    )
  }

  const layout = tableLayout(table.lemma, table.cells)
  const firstWrong = results ? Object.entries(results).find(([, r]) => !r.correct) : undefined
  const topic = firstWrong ? topicFor(table.lemma.class, firstWrong[0], firstWrong[1].errorKind) : classTopic(table.lemma.class)
  const right = results ? Object.values(results).filter((r) => r.correct).length : 0
  let firstBlank = true

  return (
    <div className="page fill-table">
      <h1 tabIndex={-1}>Fill the table</h1>
      <fieldset className="difficulty">
        <legend>Blanks</legend>
        {DIFFICULTIES.map((d) => (
          <label key={d} className="choice inline">
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
            {DIFFICULTY_LABELS[d]}
          </label>
        ))}
      </fieldset>

      <div className="stage" data-testid="table" data-lemma={lemmaRef(table.lemma)}>
        <LemmaLine lemma={table.lemma} />
        <h2>{table.block ? blockLabel(table.block) : classLabel(table.lemma.class)}</h2>
        {layout.sections.map((section, si) => (
          <table key={si} className="paradigm">
            {section.title && <caption>{section.title}</caption>}
            <thead>
              <tr>
                <td />
                {section.columns.map((c) => (
                  <th key={c} scope="col">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {section.rows.map((row) => (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  {row.keys.map((key, ki) => {
                    if (!key) return <td key={ki} className="missing" aria-label="not in the data" />
                    const cell = table.cells.find((c) => c.key === key)!
                    if (!table.blanks.has(key)) {
                      return (
                        <td key={key} lang="grc" className="given">
                          {cell.forms.map((f) => displayForm(f, { lengthMarks: settings.lengthMarks })).join(', ')}
                        </td>
                      )
                    }
                    const r = results?.[key]
                    const isFirst = firstBlank
                    firstBlank = false
                    return (
                      <td key={key} className={r ? (r.correct ? 'right' : 'wrong') : 'blank'}>
                        <GreekInput
                          ref={isFirst ? first : undefined}
                          aria-label={cellLabel(key)}
                          aria-describedby={r ? `result-${key}` : undefined}
                          data-cell={key}
                          value={answers[key] ?? ''}
                          readOnly={Boolean(results)}
                          onValueChange={(v) => setAnswers((a) => ({ ...a, [key]: v }))}
                          onEnter={onEnter}
                        />
                        {r && (
                          <div className="cell-result" id={`result-${key}`} data-testid={`result-${key}`}>
                            {r.correct ? (
                              <span className="ok-text">✓ right{r.notes.length ? ` (check ${listWords(r.notes)})` : ''}</span>
                            ) : (
                              <>
                                <span className="bad-text">✗ wrong: {r.errorKind === 'blank' ? 'no answer' : listWords(r.errors)}</span>{' '}
                                <Diff segments={r.diff.expected} />
                                {cell.forms.length > 1 && <span className="muted"> (or {cell.forms.length - 1} more)</span>}
                              </>
                            )}
                          </div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        ))}
      </div>

      {results ? (
        <section className={`feedback ${right === Object.keys(results).length ? 'ok' : 'bad'}`} aria-live="polite">
          <p className="verdict">
            <strong>
              {right} of {Object.keys(results).length} right
            </strong>
          </p>
          <p className="actions">
            <NoteLink topic={topic} />
            <button type="button" className="primary" onClick={() => newTable()}>
              Next table <kbd>Enter</kbd>
            </button>
          </p>
        </section>
      ) : (
        <p>
          <button type="button" className="primary" onClick={check}>
            Check the table <kbd>Enter</kbd>
          </button>
        </p>
      )}
      <details className="keyboard-toggle">
        <summary>Greek keyboard and typing help</summary>
        <TypingHint />
        <GreekKeyboard />
      </details>
      <Tally {...score} />
    </div>
  )
}
