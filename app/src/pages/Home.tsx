// Learn: the path of units and lessons (docs/plans/redesign.md). Every lesson is open; the start
// recommended sits a little below the player's level; a unit index jumps to any unit.
import { type CSSProperties, useEffect } from 'react'
import { useApp } from '../app/AppContext'
import { href } from '../app/router'
import { useNow } from '../app/useNow'
import { Icon, type IconName } from '../components/Icon'
import { Owl } from '../components/Owl'
import { WeakSpots } from '../components/WeakSpots'
import { loadAttempts } from '../lib/attempts'
import { displayForm } from '../lib/normalize'
import {
  type Lesson,
  type LessonKind,
  type PathState,
  type Recommendation,
  type Unit,
  lessonDone,
  lessonsOf,
  loadPath,
  recommend,
  unitSettings,
  unitsInData,
} from '../lib/path'
import { lemmasInScope } from '../lib/prompts'
import { reviewQueue } from '../lib/review'
import { loadSrs } from '../lib/srs'

const KIND_ICONS: Record<LessonKind, IconName> = { parse: 'eye', make: 'pen', mixed: 'spark', table: 'grid', test: 'trophy' }
// how far each of a unit's five nodes sits from the centre line, in node widths
const SWAY = [0, 0.7, 1.1, 0.7, 0]

/** Scroll a unit into view and move the focus to its heading. */
function goToUnit(id: string) {
  const heading = document.getElementById(`unit-${id}`)
  if (!heading) return
  heading.closest('section')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
  heading.focus({ preventScroll: true })
}

type NodeState = 'done' | 'recommended' | 'open'

function Node({ lesson, state, side }: { lesson: Lesson; state: NodeState; side: number }) {
  return (
    <li className={`node-row ${state}`} style={{ '--sway': side } as CSSProperties}>
      <a className={`node ${state}`} href={href('lesson', lesson.id)}>
        {state === 'recommended' && (
          <span className="start-bubble" aria-hidden="true">
            Start
          </span>
        )}
        <span className="coin">
          <Icon name={state === 'done' && lesson.kind !== 'test' ? 'check' : KIND_ICONS[lesson.kind]} size={30} />
        </span>
        <span className="node-label">
          {state !== 'open' && <span className="sr-only">{state === 'done' ? 'Done, practise again: ' : 'Recommended: '}</span>}
          {lesson.title}
        </span>
      </a>
    </li>
  )
}

function UnitSection({ unit, n, path, rec }: { unit: Unit; n: number; path: PathState; rec: Recommendation | undefined }) {
  const { data, settings } = useApp()
  const lessons = lessonsOf(unit)
  const done = lessons.filter((l) => lessonDone(path, l.id)).length
  const words = lemmasInScope(data, unitSettings(unit, settings))
    .sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity))
    .slice(0, 3)
  const dir = n % 2 ? -1 : 1
  const recommended = rec?.lesson.unit.id === unit.id
  return (
    <section
      className={`unit family-${unit.family}${done === lessons.length ? ' complete' : ''}${recommended ? ' recommended' : ''}`}
      aria-labelledby={`unit-${unit.id}`}
    >
      <header className="unit-banner">
        <div className="unit-text">
          <p className="unit-number">
            Unit {n}
            {recommended && <span className="pill">Recommended</span>}
          </p>
          <h2 id={`unit-${unit.id}`} tabIndex={-1}>
            {unit.title}
          </h2>
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
          <Node
            key={l.id}
            lesson={l}
            state={rec?.lesson.id === l.id ? 'recommended' : lessonDone(path, l.id) ? 'done' : 'open'}
            side={SWAY[i] * dir}
          />
        ))}
      </ol>
    </section>
  )
}

function Hero({ rec, units, placed }: { rec: Recommendation | undefined; units: Unit[]; placed: boolean }) {
  const number = (u: Unit) => units.findIndex((x) => x.id === u.id) + 1
  const level = rec && rec.level >= 0 ? units[rec.level] : undefined
  return (
    <section className={`hero family-${rec?.lesson.unit.family ?? 'early'}`}>
      <Owl mood={rec ? 'calm' : 'cheer'} size={104} className="hero-owl" />
      <div className="hero-text">
        <h1 tabIndex={-1}>Your path</h1>
        {!rec && <p className="hero-next">You have finished every lesson. Review keeps the forms fresh.</p>}
        {rec?.reason === 'new' && (
          <p className="hero-next">New here? Start with Unit 1, or take a short check to find your level. Every unit is open.</p>
        )}
        {rec && level && (
          <p className="hero-next">
            You are solid up to Unit {number(level)}, {level.title}.
            {rec.reason === 'warm-up' ? ' Warm up there first, then carry on.' : ''}
          </p>
        )}
        {rec && rec.reason !== 'new' && (
          <p className="hero-rec">
            Recommended: Unit {number(rec.lesson.unit)}, {rec.lesson.unit.title}: <strong>{rec.lesson.title}</strong>
          </p>
        )}
      </div>
      <div className="hero-actions">
        {rec ? (
          <a className="btn primary big" href={href('lesson', rec.lesson.id)}>
            Start lesson
          </a>
        ) : (
          <a className="btn primary big" href={href('review')}>
            Review
          </a>
        )}
        <a className="btn" href={href('placement')}>
          {placed ? 'Check my level again' : 'Find my level'}
        </a>
      </div>
    </section>
  )
}

export function Home({ unit }: { unit?: string }) {
  const { data, settings, store } = useApp()
  const now = useNow()
  const queue = reviewQueue(data, settings, loadSrs(store), now, Math.random)
  const due = queue.filter((e) => !e.isNew).length
  const units = unitsInData(data, settings)
  const path = loadPath(store)
  const rec = recommend(path, loadAttempts(store), now)

  useEffect(() => {
    if (unit) goToUnit(unit)
  }, [unit])

  return (
    <div className="page home">
      <Hero rec={rec} units={units} placed={Boolean(path.placement)} />

      <a className="review-strip" href={href('review')}>
        <span className="review-icon">
          <Icon name="review" size={24} />
        </span>
        <span>
          <strong>Review</strong>{' '}
          <span className="muted">{queue.length ? `${due} due, ${queue.length - due} new today` : 'nothing due right now'}</span>
        </span>
      </a>

      <WeakSpots />

      <nav className="unit-index" aria-label="Units">
        <ol>
          {units.map((u, i) => {
            const complete = lessonsOf(u).every((l) => lessonDone(path, l.id))
            return (
              <li key={u.id}>
                <button
                  type="button"
                  className={`unit-chip family-${u.family}${rec?.lesson.unit.id === u.id ? ' recommended' : ''}${complete ? ' complete' : ''}`}
                  onClick={() => goToUnit(u.id)}
                >
                  <span className="unit-chip-number">{complete ? <Icon name="check" size={16} /> : i + 1}</span>
                  {u.title}
                </button>
              </li>
            )
          })}
        </ol>
      </nav>

      <div className="path">
        {units.map((u, i) => (
          <UnitSection key={u.id} unit={u} n={i + 1} path={path} rec={rec} />
        ))}
      </div>
    </div>
  )
}
