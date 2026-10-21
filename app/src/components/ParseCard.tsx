// One "what form is this?" exercise: used by Parse it and by lessons. Any valid parse is right.
import { useEffect, useRef, useState } from 'react'
import { useApp, useSound } from '../app/AppContext'
import { useKeys } from '../app/useKeys'
import { type ParseSelection, checkParse } from '../lib/check'
import { lemmaRef } from '../lib/data'
import { cellLabel } from '../lib/features'
import { displayForm } from '../lib/normalize'
import { topicFor } from '../lib/notes'
import { type Group, type Picks, nearestParse, parseGroups, selectionOf, selectionWords, skipped } from '../lib/parsing'
import type { ParsePrompt } from '../lib/prompts'
import { NoteLink, SheetHead } from './Feedback'
import { LemmaLine } from './LemmaLine'
import { Owl } from './Owl'
import { WeakHint } from './WeakSpots'

export interface ParseAnswer {
  correct: boolean
  errorKind: 'parse' | null
  /** The cell the answer is recorded against: the parse chosen when right, else the one asked. */
  cell: string
}

interface Props {
  prompt: ParsePrompt
  onAnswer(answer: ParseAnswer): void
  onNext(): void
}

export function ParseCard({ prompt, onAnswer, onNext }: Props) {
  const { settings } = useApp()
  const sound = useSound()
  const [picks, setPicks] = useState<Picks>({})
  const [active, setActive] = useState(0)
  const [answer, setAnswer] = useState<{ correct: boolean; selection: ParseSelection } | null>(null)
  const [missing, setMissing] = useState<string | null>(null)
  const stage = useRef<HTMLDivElement>(null)
  const feedback = useRef<HTMLElement>(null)

  // a new prompt mounts a new card (callers give it a key)
  useEffect(() => {
    ;(answer ? feedback : stage).current?.focus()
  }, [answer])

  const groups: Group[] = parseGroups(prompt.lemma, { dual: settings.scope.dual })

  function choose(index: number, value: string) {
    const group = groups[index]
    const next: Picks = { ...picks, [group.id]: value }
    if (skipped('person', next)) {
      delete next.person
      delete next.number
    }
    setPicks(next)
    setMissing(null)
    const after = groups.findIndex((g, i) => i > index && !skipped(g.id, next) && next[g.id] === undefined)
    setActive(after >= 0 ? after : index)
  }

  function check() {
    if (answer) return
    const left = groups.find((g) => !skipped(g.id, picks) && picks[g.id] === undefined)
    if (left) {
      setMissing(`Choose the ${left.label.toLowerCase()} first.`)
      return
    }
    const selection = selectionOf(prompt.lemma, picks)
    const result = checkParse(selection, prompt.parses)
    const cell = result.correct ? nearestParse(selection, prompt.parses).parse.key : prompt.cell.key
    sound(result.correct ? 'right' : 'wrong')
    onAnswer({ correct: result.correct, errorKind: result.correct ? null : 'parse', cell })
    setAnswer({ correct: result.correct, selection })
  }

  useKeys((e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (answer) onNext()
      else check()
      return
    }
    const n = Number(e.key)
    if (!answer && Number.isInteger(n) && n >= 1) {
      const group = groups[active]
      const option = group?.options[n - 1]
      if (option && !skipped(group.id, picks)) {
        e.preventDefault()
        choose(active, option.value)
      }
    }
  })

  const nearest = answer && !answer.correct ? nearestParse(answer.selection, prompt.parses) : null
  const ready = groups.every((g) => skipped(g.id, picks) || picks[g.id] !== undefined)

  return (
    <div className="exercise">
      <p className="instruction">What form is this?</p>
      <div ref={stage} tabIndex={-1} className="stage" data-testid="prompt" data-lemma={lemmaRef(prompt.lemma)}>
        <Owl size={92} mood="calm" className="stage-owl" />
        <div className="bubble">
          <p className="shown-form" lang="grc" data-testid="form">
            {displayForm(prompt.form, { lengthMarks: settings.lengthMarks })}
          </p>
          <LemmaLine lemma={prompt.lemma} />
        </div>
      </div>
      <p className="hint">Click a choice or type its number; the outlined row takes it. Enter checks.</p>
      <div className="option-groups">
        {groups.map((g, i) => {
          const off = skipped(g.id, picks)
          return (
            <div key={g.id} role="group" aria-label={g.label} className={`options${i === active && !answer ? ' active' : ''}`}>
              <span className="options-label">{g.label}</span>
              <div className="chips">
                {g.options.map((o, j) => (
                  <button
                    key={o.value}
                    type="button"
                    className="chip"
                    aria-pressed={picks[g.id] === o.value}
                    disabled={off || Boolean(answer)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => choose(i, o.value)}
                  >
                    <kbd>{j + 1}</kbd> {o.label}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
      <div aria-live="polite">
        {missing && (
          <p role="alert" className="missing">
            {missing}
          </p>
        )}
      </div>
      {!answer && (
        <div className="answer-bar">
          <button type="button" className={`btn primary big${ready ? '' : ' waiting'}`} onClick={check}>
            Check <kbd>Enter</kbd>
          </button>
        </div>
      )}
      <div aria-live="polite">
        {answer && (
          <section ref={feedback} tabIndex={-1} className={`feedback sheet ${answer.correct ? 'ok' : 'bad'}`} aria-label="Feedback">
            <div className="sheet-inner">
              <div className="sheet-body">
                <SheetHead ok={answer.correct}>
                  <strong>{answer.correct ? 'Correct' : 'Not quite'}</strong>
                </SheetHead>
                {nearest && (
                  <p className="verdict-detail">
                    You chose{' '}
                    {selectionWords(answer.selection).map((w, i) => (
                      <span key={w.feature}>
                        {i > 0 && ' '}
                        {nearest.wrong.has(w.feature) ? <mark>{w.text}</mark> : w.text}
                      </span>
                    ))}
                    .
                  </p>
                )}
                <p className="verdict-detail">{prompt.parses.length > 1 ? 'This form can be:' : 'This form is:'}</p>
                <ul aria-label="Valid parses" className="parses">
                  {prompt.parses.map((c) => (
                    <li key={c.key}>{cellLabel(c.key)}</li>
                  ))}
                </ul>
                {!answer.correct && <WeakHint featureKey={prompt.featureKey} />}
                <NoteLink topic={topicFor(prompt.lemma.class, prompt.cell.key, answer.correct ? null : 'parse')} />
              </div>
              <button type="button" className={`btn big ${answer.correct ? 'primary' : 'danger'}`} onClick={onNext}>
                Continue <kbd>Enter</kbd>
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
