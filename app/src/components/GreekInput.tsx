// An answer box that turns beta code into Greek as you type (SPEC §7). Text typed with a Greek
// keyboard passes through unchanged.

import { type InputHTMLAttributes, type Ref, useEffect, useLayoutEffect, useRef } from 'react'
import { betaToGreek } from '../lib/betacode'
import { useTyping } from './typing'

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: string
  onValueChange(value: string): void
  onEnter?(): void
  ref?: Ref<HTMLInputElement>
}

export function GreekInput({ value, onValueChange, onEnter, onFocus, onKeyDown, ref, ...rest }: Props) {
  const input = useRef<HTMLInputElement | null>(null)
  const caret = useRef<number | null>(null)
  const latest = useRef({ value, onValueChange })
  const typing = useTyping()
  const release = useRef<(() => void) | null>(null)

  useEffect(() => {
    latest.current = { value, onValueChange }
  })
  useEffect(() => () => release.current?.(), [])
  // Put the caret back after the converted text once React has rendered the new value.
  useLayoutEffect(() => {
    if (caret.current !== null && input.current) {
      input.current.setSelectionRange(caret.current, caret.current)
      caret.current = null
    }
  })

  /** Convert what precedes the caret; what follows was converted already. */
  function update(before: string, after: string) {
    const converted = betaToGreek(before)
    caret.current = converted.length
    latest.current.onValueChange(converted + after)
  }

  function insert(text: string) {
    const current = latest.current.value
    const start = input.current?.selectionStart ?? current.length
    const end = input.current?.selectionEnd ?? start
    update(current.slice(0, start) + text, current.slice(end))
  }

  return (
    <input
      {...rest}
      ref={(el) => {
        input.current = el
        if (typeof ref === 'function') ref(el)
        else if (ref) ref.current = el
      }}
      type="text"
      lang="grc"
      className={['greek-input', rest.className].filter(Boolean).join(' ')}
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
      value={value}
      onChange={(e) => {
        const at = e.target.selectionStart ?? e.target.value.length
        update(e.target.value.slice(0, at), e.target.value.slice(at))
      }}
      onFocus={(e) => {
        release.current?.()
        release.current = typing?.target(insert) ?? null
        onFocus?.(e)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && onEnter) {
          e.preventDefault()
          onEnter()
        }
        onKeyDown?.(e)
      }}
    />
  )
}
