// Endings sprint (SPEC §5): sixty seconds of endings for one class or one tense-voice block,
// derived from the verified model paradigms. Accents never count here.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../app/AppContext'
import { useKeys } from '../app/useKeys'
import { EmptyScope } from '../components/EmptyScope'
import { GreekInput } from '../components/GreekInput'
import { GreekKeyboard } from '../components/GreekKeyboard'
import { TypingHint } from '../components/TypingHint'
import { recordAttempt } from '../lib/attempts'
import { type SprintItem, type SprintSet, checkEnding, goldenModels, setPos, setsInScope, sprintItems, sprintSets } from '../lib/endings'
import { cellLabel, featureKey } from '../lib/features'
import type { Rng } from '../lib/prompts'

const SECONDS = 60
const GROUPS = [
  ['noun', 'Nouns'],
  ['adj', 'Adjectives'],
  ['verb', 'Verbs'],
] as const
const BEST_KEY = 'sprint.best'

type Phase =
  | { kind: 'choose' }
  | { kind: 'play'; set: SprintSet; endsAt: number }
  | { kind: 'done'; set: SprintSet; score: number; best: number; newBest: boolean }

interface Last {
  item: SprintItem
  typed: string
  correct: boolean
}

function shuffled<T>(items: T[], rng: Rng): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export function EndingsSprint({ rng = Math.random }: { rng?: Rng }) {
  const { data, settings, store } = useApp()
  const all = useMemo(
    () => sprintSets(goldenModels(), Object.fromEntries(data.lemmasWhere({ pos: ['verb'] }).map((l) => [l.lemma, 'aoristType' in l ? l.aoristType : []]))),
    [data],
  )
  const sets = setsInScope(all, settings.scope)
  const [phase, setPhase] = useState<Phase>({ kind: 'choose' })
  const [queue, setQueue] = useState<SprintItem[]>([])
  const [value, setValue] = useState('')
  const [score, setScore] = useState(0)
  const [last, setLast] = useState<Last | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const input = useRef<HTMLInputElement>(null)
  const best = () => store.read<Record<string, number>>(BEST_KEY, {})

  function start(set: SprintSet) {
    setQueue(shuffled(sprintItems(set, { dual: settings.scope.dual }), rng))
    setValue('')
    setScore(0)
    setLast(null)
    setNow(Date.now())
    setPhase({ kind: 'play', set, endsAt: Date.now() + SECONDS * 1000 })
  }

  useEffect(() => {
    if (phase.kind === 'play') input.current?.focus()
  }, [phase])

  useEffect(() => {
    if (phase.kind !== 'play') return
    const timer = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(timer)
  }, [phase])

  useEffect(() => {
    if (phase.kind !== 'play' || now < phase.endsAt) return
    const record = best()
    const previous = record[phase.set.id] ?? 0
    if (score > previous) store.write(BEST_KEY, { ...record, [phase.set.id]: score })
    setPhase({ kind: 'done', set: phase.set, score, best: Math.max(score, previous), newBest: score > previous })
  })

  function answer() {
    if (phase.kind !== 'play') return
    const item = queue[0]
    const correct = checkEnding(value, item)
    // logged for the statistics only: an ending is not the model word's whole form, so the
    // spaced-repetition cards are left alone
    recordAttempt(store, {
      itemKey: `sprint:${phase.set.id}|${item.cell}`,
      featureKey: featureKey(phase.set.cls, item.cell),
      correct,
      errorKind: correct ? null : value.trim() ? 'ending' : 'blank',
      ts: Date.now(),
      mode: 'sprint',
    })
    if (correct) setScore((s) => s + 1)
    setLast({ item, typed: value, correct })
    setValue('')
    const rest = queue.slice(1)
    if (rest.length) setQueue(rest)
    else {
      // a new round of the set's cells, not starting with the one just asked
      const again = shuffled(sprintItems(phase.set, { dual: settings.scope.dual }), rng)
      if (again.length > 1 && again[0].cell === item.cell) again.push(again.shift()!)
      setQueue(again)
    }
  }

  useKeys((e) => {
    if (e.key === 'Enter' && phase.kind === 'done') {
      e.preventDefault()
      start(phase.set)
    }
  })

  if (phase.kind === 'choose') {
    const record = best()
    return (
      <div className="page sprint">
        <h1 tabIndex={-1}>Endings sprint</h1>
        {sets.length ? (
          <>
            <p>
              Sixty seconds to type as many endings as you can. Pick a declension class or a tense and voice; the stem is
              given. Accents do not count.
            </p>
            <ul className="set-groups" aria-label="Sprint sets">
              {GROUPS.filter(([pos]) => sets.some((s) => setPos(s) === pos)).map(([pos, title]) => (
                <li key={pos}>
                  <h2>{title}</h2>
                  <ul className="sets">
                    {sets
                      .filter((s) => setPos(s) === pos)
                      .map((s) => (
                        <li key={s.id}>
                          <button type="button" onClick={() => start(s)}>
                            <span className="set-label">{s.label}</span>
                            <span className="set-model">
                              model: <span lang="grc">{s.lemma}</span>
                              {record[s.id] ? ` · best ${record[s.id]}` : ''}
                            </span>
                          </button>
                        </li>
                      ))}
                  </ul>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <EmptyScope />
        )}
      </div>
    )
  }

  if (phase.kind === 'done') {
    return (
      <div className="page sprint">
        <h1 tabIndex={-1}>Endings sprint</h1>
        <section className="feedback ok" aria-live="polite">
          <h2>Time’s up</h2>
          <p className="verdict">
            <strong>Score: {phase.score}</strong> · {phase.set.label}
          </p>
          <p>{phase.newBest ? 'New best!' : `Best: ${phase.best}`}</p>
          <p className="actions">
            <button type="button" onClick={() => setPhase({ kind: 'choose' })}>
              Choose another set
            </button>
            <button type="button" className="primary" onClick={() => start(phase.set)}>
              Play again <kbd>Enter</kbd>
            </button>
          </p>
        </section>
      </div>
    )
  }

  const item = queue[0]
  const left = Math.max(0, Math.ceil((phase.endsAt - now) / 1000))
  return (
    <div className="page sprint">
      <h1 tabIndex={-1}>Endings sprint</h1>
      <p className="sprint-bar">
        <span>{phase.set.label}</span>
        <span className="clock" aria-live="off">
          {left} s
        </span>
        <span>
          Score: <strong data-testid="score">{score}</strong>
        </span>
      </p>
      <div
        className="stage"
        data-testid="sprint-item"
        data-set={phase.set.id}
        data-cell={item.cell}
        data-endings={item.endings.join('|')}
      >
        <p className="lemma-line">
          model: <span lang="grc" className="lemma">{phase.set.lemma}</span>
        </p>
        <p className="target">
          <strong>{cellLabel(item.cell)}</strong>
        </p>
        <p className="ending-row">
          <span lang="grc" className="stem">
            {phase.set.stemShown}–
          </span>
          <GreekInput ref={input} aria-label="Ending" className="ending-input" value={value} onValueChange={setValue} onEnter={answer} />
        </p>
      </div>
      <p data-testid="last" className="last" aria-live="polite">
        {last && (
          <>
            {cellLabel(last.item.cell, { short: true })}{' '}
            {last.correct ? <span className="ok-text">✓</span> : <span className="bad-text">✗</span>}{' '}
            <span lang="grc">–{last.item.endings.join(', –')}</span>
          </>
        )}
      </p>
      <details className="keyboard-toggle">
        <summary>Greek keyboard and typing help</summary>
        <TypingHint />
        <GreekKeyboard />
      </details>
    </div>
  )
}
