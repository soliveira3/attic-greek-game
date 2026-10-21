// Forms the player misses often, each with the lesson to revisit and the grammar note.
import { useApp } from '../app/AppContext'
import { href } from '../app/router'
import { loadAttempts } from '../lib/attempts'
import { cellLabel, classLabel } from '../lib/features'
import { NOTE_TITLES } from '../lib/notes'
import { UNITS, type WeakSpot, weakSpot, weakSpots } from '../lib/path'
import { Icon } from './Icon'

function unitNumber(spot: WeakSpot): number {
  return spot.unit ? UNITS.indexOf(spot.unit) + 1 : 0
}

function Revisit({ spot }: { spot: WeakSpot }) {
  return (
    <span className="revisit">
      {spot.lesson && (
        <a href={href('lesson', spot.lesson.id)}>
          <Icon name="play" size={16} />
          Unit {unitNumber(spot)}: {spot.lesson.title}
        </a>
      )}
      <a href={href('notes', spot.topic)}>
        <Icon name="notes" size={16} />
        {NOTE_TITLES[spot.topic]}
      </a>
    </span>
  )
}

/** The list of weak spots, or nothing when there are none. */
export function WeakSpots({ limit = 3 }: { limit?: number }) {
  const { store } = useApp()
  const spots = weakSpots(loadAttempts(store), new Date(), limit)
  if (!spots.length) return null
  return (
    <section className="weak-spots" aria-labelledby="weak-title">
      <h2 id="weak-title">
        <Icon name="target" size={22} />
        Needs practice
      </h2>
      <p className="muted">Forms you have missed often lately, and where to go over them again.</p>
      <ul>
        {spots.map((s) => (
          <li key={s.featureKey}>
            <span className="weak-what">
              <strong>{cellLabel(s.cell)}</strong> <span className="muted">{classLabel(s.cls)}</span>
            </span>
            <span className="weak-count">
              right {s.right} of the last {s.total}
            </span>
            <Revisit spot={s} />
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Shown with a wrong answer when that form is a weak spot. */
export function WeakHint({ featureKey }: { featureKey: string }) {
  const { store } = useApp()
  const spot = weakSpot(loadAttempts(store), featureKey)
  if (!spot) return null
  return (
    <p className="weak-hint">
      You have missed this form {spot.misses} times lately. Go over it again: <Revisit spot={spot} />
    </p>
  )
}
