// One "type the form" exercise: used by Make it and by Review (Phase 5).

import { useEffect, useRef, useState } from 'react'
import { useApp } from '../app/AppContext'
import { useKeys } from '../app/useKeys'
import { type CheckResult, checkAnswer } from '../lib/check'
import { lemmaRef } from '../lib/data'
import { topicFor } from '../lib/notes'
import type { MakePrompt } from '../lib/prompts'
import { Feedback } from './Feedback'
import { GreekInput } from './GreekInput'
import { GreekKeyboard } from './GreekKeyboard'
import { LemmaLine } from './LemmaLine'
import { TypingHint } from './TypingHint'

interface Props {
  prompt: MakePrompt
  onAnswer(result: CheckResult): void
  onNext(): void
}

export function MakeCard({ prompt, onAnswer, onNext }: Props) {
  const { settings } = useApp()
  const [value, setValue] = useState('')
  const [result, setResult] = useState<CheckResult | null>(null)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setValue('')
    setResult(null)
    input.current?.focus()
  }, [prompt])

  function submit() {
    if (result) {
      onNext()
      return
    }
    const r = checkAnswer(value, prompt.forms, settings.strictness, prompt.context)
    setResult(r)
    onAnswer(r)
  }
  useKeys((e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      submit()
    }
  })

  return (
    <>
      <div className="stage" data-testid="prompt" data-lemma={lemmaRef(prompt.lemma)} data-cell={prompt.cell.key}>
        <LemmaLine lemma={prompt.lemma} />
        <p className="target">
          Give the <strong>{prompt.label}</strong>
        </p>
        <GreekInput
          ref={input}
          aria-label="Your answer"
          aria-describedby="typing-hint"
          value={value}
          readOnly={Boolean(result)}
          onValueChange={setValue}
          onEnter={submit}
        />
        {!result && (
          <button type="button" className="primary check" onClick={submit}>
            Check <kbd>Enter</kbd>
          </button>
        )}
      </div>
      <div aria-live="polite">
        {result && (
          <Feedback
            result={result}
            forms={prompt.forms}
            topic={topicFor(prompt.lemma.class, prompt.cell.key, result.errorKind)}
            onNext={onNext}
          />
        )}
      </div>
      <details className="keyboard-toggle">
        <summary>Greek keyboard and typing help</summary>
        <TypingHint id="typing-hint" />
        <GreekKeyboard />
      </details>
    </>
  )
}
