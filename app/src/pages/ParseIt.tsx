// Parse it (SPEC §5): a form is shown; the player picks its features. Any valid parse is right.
import { useState } from 'react'
import { useApp } from '../app/AppContext'
import { EmptyScope } from '../components/EmptyScope'
import { ModeHeader } from '../components/ModeHeader'
import { ParseCard } from '../components/ParseCard'
import { Tally } from '../components/Tally'
import { lemmaRef } from '../lib/data'
import { answer as recordAnswer } from '../lib/progress'
import { type ParsePrompt, type Rng, parsePrompt } from '../lib/prompts'
import { gradeFor } from '../lib/srs'

export function ParseIt({ rng = Math.random }: { rng?: Rng }) {
  const { data, settings, store } = useApp()
  const [prompt, setPrompt] = useState<ParsePrompt | null>(() => parsePrompt(data, settings, rng))
  const [turn, setTurn] = useState(0)
  const [score, setScore] = useState({ right: 0, total: 0 })

  if (!prompt) {
    return (
      <div className="page">
        <ModeHeader title="Parse it" />
        <EmptyScope />
      </div>
    )
  }

  return (
    <div className="page parse-it play">
      <ModeHeader title="Parse it">
        <Tally {...score} />
      </ModeHeader>
      <ParseCard
        key={turn}
        prompt={prompt}
        onAnswer={(a) => {
          recordAnswer(
            store,
            {
              itemKey: `${lemmaRef(prompt.lemma)}|${a.cell}`,
              featureKey: `${prompt.lemma.class}:${a.cell}`,
              correct: a.correct,
              errorKind: a.errorKind,
              ts: Date.now(),
              mode: 'parse',
            },
            gradeFor(a.correct, false),
          )
          setScore((s) => ({ right: s.right + (a.correct ? 1 : 0), total: s.total + 1 }))
        }}
        onNext={() => {
          setPrompt(parsePrompt(data, settings, rng, prompt.itemKey))
          setTurn((t) => t + 1)
        }}
      />
    </div>
  )
}
