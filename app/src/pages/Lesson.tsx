// A lesson on the path (docs/plans/redesign.md): a short, finite run of exercises in a focused
// screen. A missed exercise comes back once at the end (not in a unit test); every answer goes to
// the attempt log and the spaced-repetition cards like in the free modes.
import { useEffect, useRef, useState } from 'react'
import { useApp, useSound } from '../app/AppContext'
import { useKeys } from '../app/useKeys'
import { href } from '../app/router'
import { useNow } from '../app/useNow'
import { Icon } from '../components/Icon'
import { MakeCard } from '../components/MakeCard'
import { Owl } from '../components/Owl'
import { ParseCard } from '../components/ParseCard'
import { TableCard } from '../components/TableCard'
import { type Attempt, itemKey, loadAttempts } from '../lib/attempts'
import { lemmaRef } from '../lib/data'
import { featureKey } from '../lib/features'
import {
  type Exercise,
  LESSONS,
  LESSON_BONUS,
  PASS_MARK,
  buildLesson,
  completeLesson,
  dailyXp,
  findLesson,
  lessonsOf,
  loadPath,
  passed,
  savePath,
} from '../lib/path'
import { answer } from '../lib/progress'
import type { Rng } from '../lib/prompts'
import { gradeFor } from '../lib/srs'
import { streak } from '../lib/stats'

interface Score {
  right: number
  total: number
}

interface Done extends Score {
  seconds: number
  passed: boolean
}

function Blocked({ title, text }: { title: string; text: string }) {
  return (
    <div className="page lesson-blocked">
      <div className="empty-state">
        <Owl mood="sad" size={140} />
        <h1 tabIndex={-1}>{title}</h1>
        <p>{text}</p>
        <p className="empty-actions">
          <a className="btn primary" href={href('home')}>
            Back to the path
          </a>
        </p>
      </div>
    </div>
  )
}

export function Lesson({ id, rng = Math.random }: { id: string; rng?: Rng }) {
  const lesson = findLesson(id)
  const [round, setRound] = useState(0)
  if (!lesson) return <Blocked title="No such lesson" text="The link points to a lesson that does not exist." />
  return <Play key={`${id}/${round}`} id={id} rng={rng} onAgain={() => setRound((r) => r + 1)} />
}

function Play({ id, rng, onAgain }: { id: string; rng: Rng; onAgain(): void }) {
  const lesson = findLesson(id)!
  const { data, settings, store } = useApp()
  const sound = useSound()
  const [queue, setQueue] = useState<Exercise[]>(() => buildLesson(data, settings, lesson, rng))
  const [at, setAt] = useState(0)
  const [score, setScore] = useState<Score>({ right: 0, total: 0 })
  const [combo, setCombo] = useState(0)
  const [done, setDone] = useState<Done | null>(null)
  const [started] = useState(() => Date.now())
  const retried = useRef(new Set<Exercise>())

  const exercise = queue[at]
  const isTest = lesson.kind === 'test'

  function record(attempt: Omit<Attempt, 'ts'>, correct: boolean, forgiven: boolean) {
    answer(store, { ...attempt, ts: Date.now() }, gradeFor(correct, forgiven))
  }

  function tally(right: number, total: number) {
    setScore((s) => ({ right: s.right + right, total: s.total + total }))
    setCombo((c) => (right === total ? c + 1 : 0))
    // a missed exercise comes back once, at the end (a unit test is taken as it comes)
    if (right < total && !isTest && !retried.current.has(exercise)) {
      retried.current.add(exercise)
      setQueue((q) => [...q, exercise])
    }
  }

  function next() {
    if (at + 1 < queue.length) {
      setAt(at + 1)
      return
    }
    const result = { right: score.right, total: score.total }
    savePath(store, completeLesson(loadPath(store), lesson.id, result, Date.now()))
    sound('done')
    setDone({ ...result, seconds: Math.round((Date.now() - started) / 1000), passed: passed(lesson.id, result) })
  }

  if (done) return <Complete lesson={lesson.id} done={done} onAgain={onAgain} />
  if (!exercise) return <Blocked title="Nothing to practise" text="This lesson has no words in the data." />

  const unit = lesson.unit
  const position = lessonsOf(unit).findIndex((l) => l.id === lesson.id) + 1
  return (
    <div className={`page lesson family-${unit.family}`}>
      <div className="lesson-top">
        <a className="icon-btn" href={href('home', unit.id)} aria-label="Quit the lesson">
          <Icon name="close" />
        </a>
        <div
          className="lesson-bar"
          role="progressbar"
          aria-label="Lesson progress"
          aria-valuemin={0}
          aria-valuemax={queue.length}
          aria-valuenow={at}
        >
          <span style={{ width: `${(100 * at) / queue.length}%` }} />
        </div>
        <span className={`combo${combo >= 2 ? ' on' : ''}`} aria-live="polite">
          {combo >= 2 && (
            <>
              <Icon name="flame" size={20} />
              {combo} in a row
            </>
          )}
        </span>
      </div>
      <p className="lesson-unit">
        <a href={href('home', unit.id)}>{unit.title}</a>, lesson {position} of 5
      </p>
      <h1 tabIndex={-1} className="lesson-title">
        {lesson.title}
      </h1>
      {exercise.kind === 'parse' && (
        <ParseCard
          key={at}
          prompt={exercise.prompt}
          onAnswer={(a) => {
            const p = exercise.prompt
            record(
              { itemKey: `${lemmaRef(p.lemma)}|${a.cell}`, featureKey: `${p.lemma.class}:${a.cell}`, correct: a.correct, errorKind: a.errorKind, mode: 'parse' },
              a.correct,
              false,
            )
            tally(a.correct ? 1 : 0, 1)
          }}
          onNext={next}
        />
      )}
      {exercise.kind === 'make' && (
        <MakeCard
          key={at}
          prompt={exercise.prompt}
          onAnswer={(r) => {
            const p = exercise.prompt
            record({ itemKey: p.itemKey, featureKey: p.featureKey, correct: r.correct, errorKind: r.errorKind, mode: 'make' }, r.correct, !r.exact)
            tally(r.correct ? 1 : 0, 1)
          }}
          onNext={next}
        />
      )}
      {exercise.kind === 'table' && (
        <TableCard
          key={at}
          table={exercise.prompt}
          onChecked={(results) => {
            const t = exercise.prompt
            for (const [key, r] of results) {
              record(
                { itemKey: itemKey(lemmaRef(t.lemma), key), featureKey: featureKey(t.lemma.class, key), correct: r.correct, errorKind: r.errorKind, mode: 'fill' },
                r.correct,
                !r.exact,
              )
            }
            tally(results.filter(([, r]) => r.correct).length, results.length)
          }}
          onNext={next}
        />
      )}
    </div>
  )
}

function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

// scattered without randomness, so the celebration looks the same in every screenshot and test
const CONFETTI = Array.from({ length: 36 }, (_, i) => ({
  x: (i * 37) % 100,
  delay: (i * 173) % 900,
  drift: ((i * 29) % 60) - 30,
  spin: 240 + ((i * 97) % 480),
}))

function Complete({ lesson: id, done, onAgain }: { lesson: string; done: Done; onAgain(): void }) {
  const lesson = findLesson(id)!
  const { store, settings } = useApp()
  const heading = useRef<HTMLHeadingElement>(null)
  const now = useNow()
  const attempts = loadAttempts(store)
  const today = dailyXp(attempts, loadPath(store), now)
  const days = streak(attempts, now)
  const accuracy = done.total ? Math.round((100 * done.right) / done.total) : 0
  const isTest = lesson.kind === 'test'
  const title = !isTest ? 'Lesson complete!' : done.passed ? 'Unit test passed!' : 'Not passed yet'

  useEffect(() => {
    heading.current?.focus()
  }, [])
  useKeys((e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      window.location.hash = href('home', lesson.unit.id)
    }
  })

  return (
    <div className="page lesson-done">
      {done.passed && (
        <div className="confetti" aria-hidden="true">
          {CONFETTI.map((c, i) => (
            <span
              key={i}
              style={{ left: `${c.x}%`, animationDelay: `${c.delay}ms`, ['--drift' as string]: `${c.drift}vw`, ['--spin' as string]: `${c.spin}deg` }}
            />
          ))}
        </div>
      )}
      <Owl mood={done.passed ? 'cheer' : 'sad'} size={160} className="done-owl" />
      <h1 tabIndex={-1} ref={heading}>
        {title}
      </h1>
      {isTest && !done.passed && <p className="lead">A unit test needs {Math.round(PASS_MARK * 100)} % right. Practise a little more and try again.</p>}
      <ul className="done-stats" aria-label="Results">
        <li className="tile gold">
          <span className="tile-label">Total XP</span>
          <span className="tile-value">
            <Icon name="bolt" size={22} />
            {done.right + LESSON_BONUS}
          </span>
        </li>
        <li className="tile olive">
          <span className="tile-label">Accuracy</span>
          <span className="tile-value">
            <Icon name="target" size={22} />
            {accuracy}%
          </span>
        </li>
        <li className="tile sea">
          <span className="tile-label">Time</span>
          <span className="tile-value">
            <Icon name="timer" size={22} />
            {clock(done.seconds)}
          </span>
        </li>
      </ul>
      <div className="done-goal">
        <p>
          <Icon name="flame" size={20} className="flame" /> {days} day streak
        </p>
        <p>
          {today >= settings.dailyGoal ? 'Daily goal reached' : `Daily goal: ${today} of ${settings.dailyGoal} XP`}
        </p>
        <div className="goal-bar" aria-hidden="true">
          <span style={{ width: `${Math.min(100, (100 * today) / settings.dailyGoal)}%` }} />
        </div>
      </div>
      <p className="done-actions">
        <button type="button" className="btn" onClick={onAgain}>
          {isTest && !done.passed ? 'Try again' : 'Practise again'}
        </button>
        {LESSONS[lesson.index + 1] && (
          <a className="btn" href={href('lesson', LESSONS[lesson.index + 1].id)}>
            Next lesson: {LESSONS[lesson.index + 1].title}
          </a>
        )}
        <a className="btn primary big" href={href('home', lesson.unit.id)}>
          Continue <kbd>Enter</kbd>
        </a>
      </p>
    </div>
  )
}
