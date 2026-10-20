import { useState } from 'react'
import { useApp } from '../app/AppContext'
import { href } from '../app/router'
import { MODES } from '../app/modes'
import { TypingHint } from '../components/TypingHint'
import { lemmasInScope } from '../lib/prompts'
import { reviewQueue } from '../lib/review'
import { loadSrs } from '../lib/srs'

const STRICTNESS_NAMES = { strict: 'strict', 'ignore-accents': 'ignore accents', lenient: 'lenient' } as const


export function Home() {
  const { data, settings, store } = useApp()
  const words = lemmasInScope(data, settings).length
  const [now] = useState(() => new Date())
  const queue = reviewQueue(data, settings, loadSrs(store), now, Math.random)
  const due = queue.filter((e) => !e.isNew).length
  return (
    <div className="page home">
      <h1 tabIndex={-1}>Attic Greek Morphology</h1>
      <p className="lead">
        Drill the forms of Attic Greek nouns, adjectives and verbs until they are automatic. Every form comes from checked
        source data.
      </p>
      <p className="review-call">
        <a href={href('review')}>Review</a>{' '}
        {queue.length ? `— ${due} due, ${queue.length - due} new today` : '— nothing due right now'}
      </p>
      <ul className="modes">
        {MODES.map((m) => (
          <li key={m.page}>
            <a href={href(m.page)}>{m.name}</a>
            <p>{m.text}</p>
          </li>
        ))}
      </ul>
      <p className="muted">
        {words} words in scope · answer checking: {STRICTNESS_NAMES[settings.strictness]} ·{' '}
        <a href={href('settings')}>change the settings</a>
      </p>
      <TypingHint />
    </div>
  )
}
