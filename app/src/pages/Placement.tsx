// Find my level (docs/plans/redesign.md): two exercises per unit in path order, over after two
// units with a miss. The level found sets the recommended start, a little below it.
import { useEffect, useRef, useState } from 'react'
import { useApp } from '../app/AppContext'
import { href } from '../app/router'
import { useNow } from '../app/useNow'
import { Icon } from '../components/Icon'
import { MakeCard } from '../components/MakeCard'
import { Owl } from '../components/Owl'
import { ParseCard } from '../components/ParseCard'
import { loadAttempts } from '../lib/attempts'
import { lemmaRef } from '../lib/data'
import { type Exercise, UNITS, loadPath, placementExercises, recommend, savePath, scorePlacement, setPlacement, unitsInData } from '../lib/path'
import { answer } from '../lib/progress'
import type { Rng } from '../lib/prompts'
import { gradeFor } from '../lib/srs'

interface Score {
  right: number
  total: number
}

export function Placement({ rng = Math.random }: { rng?: Rng }) {
  const { data, settings, store } = useApp()
  const [units] = useState(() => unitsInData(data, settings))
  const [unitAt, setUnitAt] = useState(0)
  const [items, setItems] = useState<Exercise[]>(() => placementExercises(data, settings, units[0], rng))
  const [at, setAt] = useState(0)
  const [results, setResults] = useState<Score[]>([])
  const [current, setCurrent] = useState<Score>({ right: 0, total: 0 })
  const [level, setLevel] = useState<number | null>(null)

  function tally(correct: boolean) {
    setCurrent((c) => ({ right: c.right + (correct ? 1 : 0), total: c.total + 1 }))
  }

  function next() {
    if (at + 1 < items.length) {
      setAt(at + 1)
      return
    }
    const all = [...results, current]
    const score = scorePlacement(all)
    if (score.over || unitAt + 1 >= units.length) {
      const found = score.level >= 0 ? UNITS.indexOf(units[score.level]) : -1
      savePath(store, setPlacement(loadPath(store), found, Date.now()))
      setLevel(found)
      return
    }
    setResults(all)
    setCurrent({ right: 0, total: 0 })
    setUnitAt(unitAt + 1)
    setItems(placementExercises(data, settings, units[unitAt + 1], rng))
    setAt(0)
  }

  if (level !== null) return <Result level={level} />

  const exercise = items[at]
  const unit = units[unitAt]
  return (
    <div className={`page lesson placement family-${unit.family}`}>
      <div className="lesson-top">
        <a className="icon-btn" href={href('home')} aria-label="Leave the check">
          <Icon name="close" />
        </a>
        <div
          className="lesson-bar"
          role="progressbar"
          aria-label="Placement progress"
          aria-valuemin={0}
          aria-valuemax={units.length}
          aria-valuenow={unitAt}
        >
          <span style={{ width: `${(100 * unitAt) / units.length}%` }} />
        </div>
      </div>
      <h1 tabIndex={-1} className="lesson-title placement-title">
        Find your level
      </h1>
      <p className="lesson-unit">
        Unit {unitAt + 1} of {units.length}: {unit.title}
      </p>
      {unitAt === 0 && at === 0 && (
        <p className="hint">
          Two questions a unit, in path order. The check ends once you miss something in two units; leave whenever you
          like.
        </p>
      )}
      {exercise?.kind === 'parse' && (
        <ParseCard
          key={`${unitAt}/${at}`}
          prompt={exercise.prompt}
          onAnswer={(a) => {
            const p = exercise.prompt
            answer(
              store,
              { itemKey: `${lemmaRef(p.lemma)}|${a.cell}`, featureKey: `${p.lemma.class}:${a.cell}`, correct: a.correct, errorKind: a.errorKind, ts: Date.now(), mode: 'parse' },
              gradeFor(a.correct, false),
            )
            tally(a.correct)
          }}
          onNext={next}
        />
      )}
      {exercise?.kind === 'make' && (
        <MakeCard
          key={`${unitAt}/${at}`}
          prompt={exercise.prompt}
          onAnswer={(r) => {
            const p = exercise.prompt
            answer(
              store,
              { itemKey: p.itemKey, featureKey: p.featureKey, correct: r.correct, errorKind: r.errorKind, ts: Date.now(), mode: 'make' },
              gradeFor(r.correct, !r.exact),
            )
            tally(r.correct)
          }}
          onNext={next}
        />
      )}
    </div>
  )
}

function Result({ level }: { level: number }) {
  const { store } = useApp()
  const heading = useRef<HTMLHeadingElement>(null)
  const now = useNow()
  const rec = recommend(loadPath(store), loadAttempts(store), now)
  useEffect(() => {
    heading.current?.focus()
  }, [])
  const number = (id: string) => UNITS.findIndex((u) => u.id === id) + 1
  return (
    <div className="page lesson-done placement-done">
      <Owl mood="happy" size={150} />
      <h1 tabIndex={-1} ref={heading}>
        Your level
      </h1>
      <p className="lead">
        {level >= 0
          ? `You know the forms up to Unit ${level + 1}, ${UNITS[level].title}.`
          : 'The best place to begin is the beginning.'}
      </p>
      {rec && (
        <p className="placement-rec">
          Recommended start: Unit {number(rec.lesson.unit.id)}, {rec.lesson.unit.title}: <strong>{rec.lesson.title}</strong>
          {rec.reason === 'warm-up' && ', a little below your level to warm up'}.
        </p>
      )}
      <p className="muted">Every unit stays open: go anywhere on the path at your own pace.</p>
      <p className="done-actions">
        <a className="btn" href={rec ? href('home', rec.lesson.unit.id) : href('home')}>
          See the path
        </a>
        {rec && (
          <a className="btn primary big" href={href('lesson', rec.lesson.id)}>
            Start there
          </a>
        )}
      </p>
    </div>
  )
}
