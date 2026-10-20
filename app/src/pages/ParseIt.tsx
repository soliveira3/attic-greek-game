// Parse it (SPEC §5): a form is shown; the player picks its features. Any valid parse is right.

import { useEffect, useRef, useState } from 'react'
import { useApp } from '../app/AppContext'
import { useKeys } from '../app/useKeys'
import { EmptyScope } from '../components/EmptyScope'
import { NoteLink } from '../components/Feedback'
import { LemmaLine } from '../components/LemmaLine'
import { Tally } from '../components/Tally'
import { type ParseSelection, checkParse } from '../lib/check'
import { lemmaRef } from '../lib/data'
import { cellLabel } from '../lib/features'
import { displayForm } from '../lib/normalize'
import { topicFor } from '../lib/notes'
import { type Group, type Picks, nearestParse, parseGroups, selectionOf, selectionWords, skipped } from '../lib/parsing'
import { answer as recordAnswer } from '../lib/progress'
import { type ParsePrompt, type Rng, parsePrompt } from '../lib/prompts'
import { gradeFor } from '../lib/srs'

interface Answer {
  correct: boolean
  selection: ParseSelection
}

export function ParseIt({ rng = Math.random }: { rng?: Rng }) {
  const { data, settings, store } = useApp()
  const [prompt, setPrompt] = useState<ParsePrompt | null>(() => parsePrompt(data, settings, rng))
  const [picks, setPicks] = useState<Picks>({})
  const [active, setActive] = useState(0)
  const [answer, setAnswer] = useState<Answer | null>(null)
  const [missing, setMissing] = useState<string | null>(null)
  const [score, setScore] = useState({ right: 0, total: 0 })
  const stage = useRef<HTMLDivElement>(null)
  const feedback = useRef<HTMLElement>(null)

  useEffect(() => {
    ;(answer ? feedback : stage).current?.focus()
  }, [answer, prompt])

  const groups: Group[] = prompt ? parseGroups(prompt.lemma, { dual: settings.scope.dual }) : []

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
    if (!prompt || answer) return
    const left = groups.find((g) => !skipped(g.id, picks) && picks[g.id] === undefined)
    if (left) {
      setMissing(`Choose the ${left.label.toLowerCase()} first.`)
      return
    }
    const selection = selectionOf(prompt.lemma, picks)
    const result = checkParse(selection, prompt.parses)
    const cell = result.correct ? nearestParse(selection, prompt.parses).parse.key : prompt.cell.key
    recordAnswer(
      store,
      {
        itemKey: `${lemmaRef(prompt.lemma)}|${cell}`,
        featureKey: `${prompt.lemma.class}:${cell}`,
        correct: result.correct,
        errorKind: result.errorKind,
        ts: Date.now(),
        mode: 'parse',
      },
      gradeFor(result.correct, false),
    )
    setScore((s) => ({ right: s.right + (result.correct ? 1 : 0), total: s.total + 1 }))
    setAnswer({ correct: result.correct, selection })
  }

  function next() {
    setPrompt(parsePrompt(data, settings, rng, prompt?.itemKey))
    setPicks({})
    setActive(0)
    setAnswer(null)
    setMissing(null)
  }

  useKeys((e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (answer) next()
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

  if (!prompt) {
    return (
      <div className="page">
        <h1 tabIndex={-1}>Parse it</h1>
        <EmptyScope />
      </div>
    )
  }

  const nearest = answer && !answer.correct ? nearestParse(answer.selection, prompt.parses) : null
  return (
    <div className="page parse-it">
      <h1 tabIndex={-1}>Parse it</h1>
      <div ref={stage} tabIndex={-1} className="stage" data-testid="prompt" data-lemma={lemmaRef(prompt.lemma)}>
        <p className="shown-form" lang="grc" data-testid="form">
          {displayForm(prompt.form, { lengthMarks: settings.lengthMarks })}
        </p>
        <LemmaLine lemma={prompt.lemma} />
      </div>

      <p className="hint">
        Pick one value in each group: click, or type its number (the highlighted group takes it). Enter checks.
      </p>
      {groups.map((g, i) => {
        const off = skipped(g.id, picks)
        return (
          <div key={g.id} role="group" aria-label={g.label} className={`options${i === active && !answer ? ' active' : ''}`}>
            <span className="options-label">{g.label}</span>
            {g.options.map((o, j) => (
              <button
                key={o.value}
                type="button"
                aria-pressed={picks[g.id] === o.value}
                disabled={off || Boolean(answer)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(i, o.value)}
              >
                <kbd>{j + 1}</kbd> {o.label}
              </button>
            ))}
          </div>
        )
      })}

      {!answer && (
        <p>
          <button type="button" className="primary" onClick={check}>
            Check <kbd>Enter</kbd>
          </button>
        </p>
      )}
      <div aria-live="polite">
        {missing && <p role="alert">{missing}</p>}
        {answer && (
          <section ref={feedback} tabIndex={-1} className={`feedback ${answer.correct ? 'ok' : 'bad'}`} aria-label="Feedback">
            <p className="verdict">
              <strong>{answer.correct ? 'Correct' : 'Not quite'}</strong>
              {nearest && (
                <span>
                  {' '}
                  You chose{' '}
                  {selectionWords(answer.selection).map((w, i) => (
                    <span key={w.feature}>
                      {i > 0 && ' '}
                      {nearest.wrong.has(w.feature) ? <mark>{w.text}</mark> : w.text}
                    </span>
                  ))}
                  .
                </span>
              )}
            </p>
            <p>{prompt.parses.length > 1 ? 'This form can be:' : 'This form is:'}</p>
            <ul aria-label="Valid parses">
              {prompt.parses.map((c) => (
                <li key={c.key}>{cellLabel(c.key)}</li>
              ))}
            </ul>
            <p className="actions">
              <NoteLink topic={topicFor(prompt.lemma.class, prompt.cell.key, answer.correct ? null : 'parse')} />
              <button type="button" className="primary" onClick={next}>
                Next <kbd>Enter</kbd>
              </button>
            </p>
          </section>
        )}
      </div>
      <Tally {...score} />
    </div>
  )
}
