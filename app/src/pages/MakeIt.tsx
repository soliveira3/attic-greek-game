// Make it (SPEC §5): a word and target features; the player types the form.

import { useState } from 'react'
import { useApp } from '../app/AppContext'
import { EmptyScope } from '../components/EmptyScope'
import { MakeCard } from '../components/MakeCard'
import { Tally } from '../components/Tally'
import { recordAttempt } from '../lib/attempts'
import { type Rng, makePrompt } from '../lib/prompts'

export function MakeIt({ rng = Math.random }: { rng?: Rng }) {
  const { data, settings, store } = useApp()
  const [prompt, setPrompt] = useState(() => makePrompt(data, settings, rng))
  const [score, setScore] = useState({ right: 0, total: 0 })

  return (
    <div className="page make-it">
      <h1 tabIndex={-1}>Make it</h1>
      {prompt ? (
        <MakeCard
          prompt={prompt}
          onAnswer={(r) => {
            recordAttempt(store, {
              itemKey: prompt.itemKey,
              featureKey: prompt.featureKey,
              correct: r.correct,
              errorKind: r.errorKind,
              ts: Date.now(),
              mode: 'make',
            })
            setScore((s) => ({ right: s.right + (r.correct ? 1 : 0), total: s.total + 1 }))
          }}
          onNext={() => setPrompt(makePrompt(data, settings, rng, prompt.itemKey))}
        />
      ) : (
        <EmptyScope />
      )}
      <Tally {...score} />
    </div>
  )
}
