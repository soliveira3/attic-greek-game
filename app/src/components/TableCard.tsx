// One paradigm with blanks: used by Fill the table and by lessons. Tab moves between blanks, Enter
// checks the whole table, Enter again moves on.
import { useEffect, useRef, useState } from 'react'
import { useApp, useSound } from '../app/AppContext'
import { useKeys } from '../app/useKeys'
import { type CheckResult, checkAnswer } from '../lib/check'
import { lemmaRef } from '../lib/data'
import { blockLabel, cellLabel, classLabel, featureKey } from '../lib/features'
import { loadAttempts } from '../lib/attempts'
import { weakSpot } from '../lib/path'
import { listWords } from '../lib/feedback'
import { displayForm } from '../lib/normalize'
import { classTopic, topicFor } from '../lib/notes'
import type { TablePrompt } from '../lib/prompts'
import { tableLayout } from '../lib/tables'
import { Diff, NoteLink, SheetHead } from './Feedback'
import { GreekInput } from './GreekInput'
import { GreekKeyboard } from './GreekKeyboard'
import { Icon } from './Icon'
import { LemmaLine } from './LemmaLine'
import { TypingHint } from './TypingHint'
import { WeakHint } from './WeakSpots'

interface Props {
  table: TablePrompt
  /** Every blank's result, in table order. */
  onChecked(results: [cell: string, result: CheckResult][]): void
  onNext(): void
}

export function TableCard({ table, onChecked, onNext }: Props) {
  const { settings, store } = useApp()
  const sound = useSound()
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [results, setResults] = useState<Record<string, CheckResult> | null>(null)
  const first = useRef<HTMLInputElement | null>(null)

  // a new table mounts a new card (callers give it a key)
  useEffect(() => {
    first.current?.focus()
  }, [])

  const layout = tableLayout(table.lemma, table.cells)
  const order = layout.sections.flatMap((s) => s.rows.flatMap((r) => r.keys)).filter((k): k is string => Boolean(k && table.blanks.has(k)))

  function check() {
    if (results) return
    const out: [string, CheckResult][] = order.map((key) => {
      const cell = table.cells.find((c) => c.key === key)!
      return [key, checkAnswer(answers[key] ?? '', cell.forms, settings.strictness, table.contexts[key])]
    })
    const allRight = out.every(([, r]) => r.correct)
    sound(allRight ? 'right' : 'wrong')
    onChecked(out)
    setResults(Object.fromEntries(out))
  }

  const onEnter = () => (results ? onNext() : check())
  useKeys((e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      onEnter()
    }
  })

  const firstWrong = results ? Object.entries(results).find(([, r]) => !r.correct) : undefined
  const topic = firstWrong ? topicFor(table.lemma.class, firstWrong[0], firstWrong[1].errorKind) : classTopic(table.lemma.class)
  const attempts = results ? loadAttempts(store) : []
  const weak = results
    ? Object.entries(results)
        .filter(([, r]) => !r.correct)
        .map(([key]) => featureKey(table.lemma.class, key))
        .find((fk) => weakSpot(attempts, fk))
    : undefined
  const total = results ? Object.keys(results).length : 0
  const right = results ? Object.values(results).filter((r) => r.correct).length : 0

  return (
    <div className="exercise">
      <p className="instruction">Fill in the table</p>
      <div className="stage table-stage" data-testid="table" data-lemma={lemmaRef(table.lemma)}>
        <div className="table-head">
          <LemmaLine lemma={table.lemma} />
          <h2>{table.block ? blockLabel(table.block) : classLabel(table.lemma.class)}</h2>
        </div>
        {layout.sections.map((section, si) => (
          <div key={si} className="table-scroll">
            <table className="paradigm">
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
                      return (
                        <td key={key} className={r ? (r.correct ? 'right' : 'wrong') : 'blank'}>
                          <GreekInput
                            ref={key === order[0] ? first : undefined}
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
          </div>
        ))}
      </div>
      <details className="keyboard-toggle">
        <summary>
          <Icon name="keyboard" size={20} /> Greek keyboard and typing help
        </summary>
        <TypingHint />
        <GreekKeyboard />
      </details>
      {results ? (
        <section className={`feedback sheet ${right === total ? 'ok' : 'bad'}`} aria-live="polite" aria-label="Feedback">
          <div className="sheet-inner">
            <div className="sheet-body">
              <SheetHead ok={right === total}>
                <strong>
                  {right} of {total} right
                </strong>
              </SheetHead>
              {weak && <WeakHint featureKey={weak} />}
              <NoteLink topic={topic} />
            </div>
            <button type="button" className={`btn big ${right === total ? 'primary' : 'danger'}`} onClick={onNext}>
              Continue <kbd>Enter</kbd>
            </button>
          </div>
        </section>
      ) : (
        <div className="answer-bar">
          <button type="button" className="btn primary big" onClick={check}>
            Check the table <kbd>Enter</kbd>
          </button>
        </div>
      )}
    </div>
  )
}
