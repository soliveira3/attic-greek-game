// Make it (SPEC §5): a word and target features; the player types the form.

import { useState } from 'react'
import { useApp } from '../app/AppContext'
import { EmptyScope } from '../components/EmptyScope'
import { MakeCard } from '../components/MakeCard'
import { ModeHeader } from '../components/ModeHeader'
import { Tally } from '../components/Tally'
import { answer } from '../lib/progress'
import { type Rng, makePrompt } from '../lib/prompts'
import { gradeFor } from '../lib/srs'

export function MakeIt({ rng = Math.random }: { rng?: Rng }) {
  const { data, settings, store } = useApp()
  const [prompt, setPrompt] = useState(() => makePrompt(data, settings, rng))
  const [score, setScore] = useState({ right: 0, total: 0 })
  const [turn, setTurn] = useState(0)

  return (
    <div className="page make-it play">
      <ModeHeader title="Make it">
        <Tally {...score} />
      </ModeHeader>
      {prompt ? (
        <MakeCard
          key={turn}
          prompt={prompt}
          onAnswer={(r) => {
            answer(
              store,
              {
                itemKey: prompt.itemKey,
                featureKey: prompt.featureKey,
                correct: r.correct,
                errorKind: r.errorKind,
                ts: Date.now(),
                mode: 'make',
              },
              gradeFor(r.correct, !r.exact),
            )
            setScore((s) => ({ right: s.right + (r.correct ? 1 : 0), total: s.total + 1 }))
          }}
          onNext={() => {
            setPrompt(makePrompt(data, settings, rng, prompt.itemKey))
            setTurn((t) => t + 1)
          }}
        />
      ) : (
        <EmptyScope />
      )}
    </div>
  )
}
