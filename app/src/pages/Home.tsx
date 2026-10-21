// Learn: the path of units and lessons (docs/plans/redesign.md), with the next lesson up top.
import { type CSSProperties, useState } from 'react'
import { useApp } from '../app/AppContext'
import { href } from '../app/router'
import { Icon, type IconName } from '../components/Icon'
import { Owl } from '../components/Owl'
import { displayForm } from '../lib/normalize'
import {
  type Lesson,
  type LessonKind,
  type LessonState,
  type Unit,
  lessonState,
  lessonsOf,
  loadPath,
  nextLesson,
  unitSettings,
  unitsInData,
} from '../lib/path'
import { lemmasInScope } from '../lib/prompts'
import { reviewQueue } from '../lib/review'
import { loadSrs } from '../lib/srs'

const KIND_ICONS: Record<LessonKind, IconName> = { parse: 'eye', make: 'pen', mixed: 'spark', table: 'grid', test: 'trophy' }
// how far each of a unit's five nodes sits from the centre line, in node widths
const SWAY = [0, 0.7, 1.1, 0.7, 0]

function Node({ lesson, state, side }: { lesson: Lesson; state: LessonState; side: number }) {
  const style = { '--sway': side } as CSSProperties
  const coin = (
    <span className="coin">
      <Icon name={state === 'locked' || state === 'jump' ? (lesson.kind === 'test' ? 'trophy' : 'lock') : state === 'done' && lesson.kind !== 'test' ? 'check' : KIND_ICONS[lesson.kind]} size={30} />
    </span>
  )
  if (state === 'locked' || state === 'jump') {
    return (
      <li className={`node-row ${state}`} style={style}>
        <span className="node locked">
          {coin}
          <span className="node-label">
            <span className="sr-only">Locked: </span>
            {lesson.title}
          </span>
        </span>
        {state === 'jump' && (
          <a className="jump" href={href('lesson', lesson.id)} aria-label={`Jump here: take the unit test of ${lesson.unit.title}`}>
            Jump here
          </a>
        )}
      </li>
    )
  }
  return (
    <li className={`node-row ${state}`} style={style}>
      <a className={`node ${state}`} href={href('lesson', lesson.id)}>
        {state === 'current' && (
          <span className="start-bubble" aria-hidden="true">
            Start
          </span>
        )}
        {coin}
        <span className="node-label">
          <span className="sr-only">{state === 'done' ? 'Done, practise again: ' : 'Start: '}</span>
          {lesson.title}
        </span>
      </a>
    </li>
  )
}

function UnitSection({ unit, n }: { unit: Unit; n: number }) {
  const { data, settings, store } = useApp()
  const path = loadPath(store)
  const lessons = lessonsOf(unit)
  const states = lessons.map((l) => lessonState(path, l.id))
  const done = states.filter((s) => s === 'done').length
  const words = lemmasInScope(data, unitSettings(unit, settings))
    .sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity))
    .slice(0, 3)
  const dir = n % 2 ? -1 : 1
  return (
    <section className={`unit family-${unit.family}${done === lessons.length ? ' complete' : ''}`} aria-labelledby={`unit-${unit.id}`}>
      <header className="unit-banner">
        <div className="unit-text">
          <p className="unit-number">Unit {n}</p>
          <h2 id={`unit-${unit.id}`}>{unit.title}</h2>
          <p className="unit-blurb">{unit.blurb}</p>
          <p className="unit-words" lang="grc">
            {words.map((w) => displayForm(w.lemma, { lengthMarks: settings.lengthMarks })).join(', ')}
          </p>
        </div>
        <div className="unit-side">
          <a className="btn guide" href={href('notes', unit.note)}>
            <Icon name="notes" size={20} />
            Guidebook
          </a>
          <p className="unit-progress">
            <span className="unit-meter" aria-hidden="true">
              <span style={{ width: `${(100 * done) / lessons.length}%` }} />
            </span>
            <span>
              {done} of {lessons.length}
            </span>
          </p>
        </div>
      </header>
      <ol className="nodes" aria-label={`Lessons of ${unit.title}`}>
        {lessons.map((l, i) => (
          <Node key={l.id} lesson={l} state={states[i]} side={SWAY[i] * dir} />
        ))}
      </ol>
    </section>
  )
}

export function Home() {
  const { data, settings, store } = useApp()
  const [now] = useState(() => new Date())
  const queue = reviewQueue(data, settings, loadSrs(store), now, Math.random)
  const due = queue.filter((e) => !e.isNew).length
  const units = unitsInData(data, settings)
  const next = nextLesson(loadPath(store))
  const nextUnit = next ? units.findIndex((u) => u.id === next.unit.id) + 1 : 0

  return (
    <div className="page home">
      <section className={`hero family-${next?.unit.family ?? 'early'}`}>
        <Owl mood={next ? 'calm' : 'cheer'} size={104} className="hero-owl" />
        <div className="hero-text">
          <h1 tabIndex={-1}>Your path</h1>
          {next ? (
            <p className="hero-next">
              Unit {nextUnit}, {next.unit.title}: <strong>{next.title}</strong>
            </p>
          ) : (
            <p className="hero-next">You have finished every unit. Review keeps the forms fresh.</p>
          )}
        </div>
        {next ? (
          <a className="btn primary big" href={href('lesson', next.id)}>
            Start lesson
          </a>
        ) : (
          <a className="btn primary big" href={href('review')}>
            Review
          </a>
        )}
      </section>

      <a className="review-strip" href={href('review')}>
        <span className="review-icon">
          <Icon name="review" size={24} />
        </span>
        <span>
          <strong>Review</strong>{' '}
          <span className="muted">{queue.length ? `${due} due, ${queue.length - due} new today` : 'nothing due right now'}</span>
        </span>
      </a>

      <div className="path">
        {units.map((u, i) => (
          <UnitSection key={u.id} unit={u} n={i + 1} />
        ))}
      </div>
    </div>
  )
}
