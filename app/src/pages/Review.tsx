// Review (SPEC §5, §8): today's FSRS queue in Make it format.

import { useRef, useState } from 'react'
import { useApp } from '../app/AppContext'
import { href } from '../app/router'
import { MakeCard } from '../components/MakeCard'
import { ModeHeader } from '../components/ModeHeader'
import { Owl } from '../components/Owl'
import { answer } from '../lib/progress'
import type { Rng } from '../lib/prompts'
import { type QueueEntry, reviewQueue } from '../lib/review'
import { gradeFor, loadSrs, nextDue } from '../lib/srs'

function when(d: Date): string {
  return d.toLocaleString(undefined, { weekday: 'long', hour: 'numeric', minute: '2-digit' })
}

export function Review({ rng = Math.random }: { rng?: Rng }) {
  const { data, settings, store } = useApp()
  const [queue, setQueue] = useState<QueueEntry[]>(() => reviewQueue(data, settings, loadSrs(store), new Date(), rng))
  const retried = useRef(new Set<string>())
  const [turn, setTurn] = useState(0)
  const [done, setDone] = useState(0)

  const entry = queue[0]
  if (!entry) {
    const next = nextDue(loadSrs(store))
    return (
      <div className="page review">
        <ModeHeader title="Review" back="home" />
        <div className="empty-state">
          <Owl mood="happy" size={140} />
          <h2>Done for now</h2>
          <p>
            {done ? `${done} answered this session. ` : 'Nothing to review right now. '}
            {next ? `Next review: ${when(next)}.` : 'Answers in any mode add words to your reviews.'}
          </p>
          <p className="empty-actions">
            <a className="btn primary" href={href('home')}>
              Continue the path
            </a>
            <a className="btn" href={href('practice')}>
              Free practice
            </a>
          </p>
        </div>
      </div>
    )
  }

  const due = queue.filter((e) => !e.isNew).length
  const fresh = queue.length - due
  return (
    <div className="page review play">
      <ModeHeader title="Review" back="home">
        <p className="tally" aria-live="polite">
          {due} to review · {fresh} new
        </p>
      </ModeHeader>
      <MakeCard
        key={turn}
        prompt={entry.prompt}
        onAnswer={(r) => {
          answer(
            store,
            {
              itemKey: entry.prompt.itemKey,
              featureKey: entry.prompt.featureKey,
              correct: r.correct,
              errorKind: r.errorKind,
              ts: Date.now(),
              mode: 'review',
            },
            gradeFor(r.correct, !r.exact),
            { introduced: entry.isNew },
          )
          setDone((n) => n + 1)
          // a missed item comes back once, at the end of the session
          if (!r.correct && !retried.current.has(entry.prompt.itemKey)) {
            retried.current.add(entry.prompt.itemKey)
            setQueue((q) => [...q, { prompt: entry.prompt, isNew: false }])
          }
        }}
        onNext={() => {
          setQueue((q) => q.slice(1))
          setTurn((t) => t + 1)
        }}
      />
    </div>
  )
}
