import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { betaToGreek } from '../lib/betacode'
import { GreekInput } from './GreekInput'
import { GreekKeyboard } from './GreekKeyboard'
import { TypingProvider } from './typing'

function Field({ onEnter, keyboard = false }: { onEnter?: () => void; keyboard?: boolean }) {
  const [value, setValue] = useState('')
  return (
    <TypingProvider>
      <GreekInput aria-label="answer" value={value} onValueChange={setValue} onEnter={onEnter} />
      <GreekInput aria-label="other" value="" onValueChange={() => {}} />
      {keyboard && <GreekKeyboard />}
    </TypingProvider>
  )
}

describe('GreekInput', () => {
  it('converts beta code as you type', async () => {
    render(<Field />)
    const input = screen.getByRole('textbox', { name: 'answer' })
    await userEvent.type(input, 'lu/seis')
    expect(input).toHaveValue(betaToGreek('lu/seis'))
  })
  it('takes marks typed before their vowel', async () => {
    render(<Field />)
    const input = screen.getByRole('textbox', { name: 'answer' })
    await userEvent.type(input, '(/a')
    expect(input).toHaveValue(betaToGreek('a(/'))
  })
  it('converts in the middle of the word and keeps the caret there', async () => {
    render(<Field />)
    const input = screen.getByRole('textbox', { name: 'answer' }) as HTMLInputElement
    await userEvent.type(input, 'lw')
    await userEvent.type(input, 'u/', { initialSelectionStart: 1, initialSelectionEnd: 1 })
    expect(input).toHaveValue(betaToGreek('lu/w'))
    expect(input.selectionStart).toBe(2)
  })
  it('is set up for Greek: no autocorrect, no spellcheck', () => {
    render(<Field />)
    const input = screen.getByRole('textbox', { name: 'answer' })
    expect(input).toHaveAttribute('lang', 'grc')
    expect(input).toHaveAttribute('spellcheck', 'false')
    expect(input).toHaveAttribute('autocomplete', 'off')
  })
  it('calls onEnter on Enter', async () => {
    const onEnter = vi.fn()
    render(<Field onEnter={onEnter} />)
    await userEvent.type(screen.getByRole('textbox', { name: 'answer' }), 'a{Enter}')
    expect(onEnter).toHaveBeenCalledTimes(1)
  })
})

describe('GreekKeyboard', () => {
  it('types letters and marks into the last focused input', async () => {
    render(<Field keyboard />)
    const input = screen.getByRole('textbox', { name: 'answer' })
    await userEvent.click(input)
    await userEvent.click(screen.getByRole('button', { name: `letter ${betaToGreek('l')}` }))
    await userEvent.click(screen.getByRole('button', { name: `letter ${betaToGreek('u')}` }))
    await userEvent.click(screen.getByRole('button', { name: 'acute accent' }))
    await userEvent.click(screen.getByRole('button', { name: `letter ${betaToGreek('w')}` }))
    expect(input).toHaveValue(betaToGreek('lu/w'))
    expect(input).toHaveFocus()
  })
  it('works from the keyboard alone', async () => {
    render(<Field keyboard />)
    const input = screen.getByRole('textbox', { name: 'answer' })
    await userEvent.click(input)
    screen.getByRole('button', { name: 'rough breathing' }).focus()
    await userEvent.keyboard('{Enter}')
    screen.getByRole('button', { name: `letter ${betaToGreek('a')}` }).focus()
    await userEvent.keyboard('{Enter}')
    expect(input).toHaveValue(betaToGreek('a('))
  })
  it('offers every letter and mark', () => {
    render(<Field keyboard />)
    expect(screen.getAllByRole('button', { name: /^letter / })).toHaveLength(24)
    for (const name of ['smooth breathing', 'rough breathing', 'acute accent', 'grave accent', 'circumflex', 'iota subscript', 'diaeresis']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument()
    }
  })
  it('does nothing before an input has been focused', async () => {
    render(<Field keyboard />)
    await userEvent.click(screen.getByRole('button', { name: `letter ${betaToGreek('a')}` }))
    expect(screen.getByRole('textbox', { name: 'answer' })).toHaveValue('')
  })
})
