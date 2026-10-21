// One "type the form" exercise: used by Make it and by Review (Phase 5).

import { useEffect, useRef, useState } from 'react'
import { useApp, useSound } from '../app/AppContext'
import { useKeys } from '../app/useKeys'
import { type CheckResult, checkAnswer } from '../lib/check'
import { lemmaRef } from '../lib/data'
import { topicFor } from '../lib/notes'
import type { MakePrompt } from '../lib/prompts'
import { Feedback } from './Feedback'
import { GreekInput } from './GreekInput'
import { GreekKeyboard } from './GreekKeyboard'
import { Icon } from './Icon'
import { LemmaLine } from './LemmaLine'
import { Owl } from './Owl'
import { TypingHint } from './TypingHint'
import { WeakHint } from './WeakSpots'

interface Props {
  prompt: MakePrompt
  onAnswer(result: CheckResult): void
  onNext(): void
}

export function MakeCard({ prompt, onAnswer, onNext }: Props) {
  const { settings } = useApp()
  const sound = useSound()
  const [value, setValue] = useState('')
  const [result, setResult] = useState<CheckResult | null>(null)
  const input = useRef<HTMLInputElement>(null)

  // a new prompt mounts a new card (callers give it a key), so only the focus needs setting
  useEffect(() => {
    input.current?.focus()
  }, [])

  function submit() {
    if (result) {
      onNext()
      return
    }
    const r = checkAnswer(value, prompt.forms, settings.strictness, prompt.context)
    sound(r.correct ? 'right' : 'wrong')
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
    <div className="exercise">
      <p className="instruction">Write this form</p>
      <div className="stage" data-testid="prompt" data-lemma={lemmaRef(prompt.lemma)} data-cell={prompt.cell.key}>
        <Owl size={92} mood="calm" className="stage-owl" />
        <div className="bubble">
          <LemmaLine lemma={prompt.lemma} />
          <p className="target">{prompt.label}</p>
        </div>
      </div>
      <div className="answer-field">
        <GreekInput
          ref={input}
          aria-label="Your answer"
          aria-describedby="typing-hint"
          placeholder="Type in Greek or beta code"
          value={value}
          readOnly={Boolean(result)}
          onValueChange={setValue}
          onEnter={submit}
        />
      </div>
      <details className="keyboard-toggle">
        <summary>
          <Icon name="keyboard" size={20} /> Greek keyboard and typing help
        </summary>
        <TypingHint id="typing-hint" />
        <GreekKeyboard />
      </details>
      {!result && (
        <div className="answer-bar">
          <button type="button" className={`btn primary big${value.trim() ? '' : ' waiting'}`} onClick={submit}>
            Check <kbd>Enter</kbd>
          </button>
        </div>
      )}
      <div aria-live="polite">
        {result && (
          <Feedback
            result={result}
            forms={prompt.forms}
            topic={topicFor(prompt.lemma.class, prompt.cell.key, result.errorKind)}
            onNext={onNext}
            extra={!result.correct && <WeakHint featureKey={prompt.featureKey} />}
          />
        )}
      </div>
    </div>
  )
}
