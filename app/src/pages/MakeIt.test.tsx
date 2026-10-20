import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { loadAttempts } from '../lib/attempts'
import { greekToBeta } from '../lib/betacode'
import { seededRng } from '../lib/prompts'
import { testData } from '../test/data'
import { renderWithApp } from '../test/render'
import { MakeIt } from './MakeIt'

function asked() {
  const el = screen.getByTestId('prompt')
  const lemma = testData.lemma(el.dataset.lemma!)!
  return { lemma, cell: el.dataset.cell!, forms: testData.forms(lemma, el.dataset.cell!) }
}

describe('MakeIt', () => {
  it('asks for one form of a word', () => {
    renderWithApp(<MakeIt rng={seededRng(1)} />)
    const { lemma } = asked()
    expect(screen.getByTestId('prompt')).toHaveTextContent(lemma.gloss)
    expect(screen.getByRole('textbox', { name: /your answer/i })).toHaveFocus()
  })
  it('accepts the right form typed in beta code and records it', async () => {
    const { store } = renderWithApp(<MakeIt rng={seededRng(2)} />)
    const { forms } = asked()
    await userEvent.type(screen.getByRole('textbox', { name: /your answer/i }), `${greekToBeta(forms[0])}{Enter}`)
    expect(screen.getByText('Correct')).toBeInTheDocument()
    expect(loadAttempts(store)[0]).toMatchObject({ correct: true, mode: 'make', errorKind: null })
  })
  it('explains a wrong form, then Enter moves on', async () => {
    const { store } = renderWithApp(<MakeIt rng={seededRng(3)} />)
    const first = asked()
    const input = screen.getByRole('textbox', { name: /your answer/i })
    await userEvent.type(input, 'xyz{Enter}')
    expect(screen.getByText('Not quite')).toBeInTheDocument()
    expect(screen.getByText('Correct form:')).toBeInTheDocument()
    expect(input).toHaveAttribute('readonly')
    expect(loadAttempts(store)[0]).toMatchObject({ correct: false, mode: 'make' })
    await userEvent.keyboard('{Enter}')
    expect(screen.queryByText('Not quite')).not.toBeInTheDocument()
    expect(input).toHaveValue('')
    expect(input).toHaveFocus()
    expect(`${asked().lemma.id}|${asked().cell}`).not.toBe(`${first.lemma.id}|${first.cell}`)
  })
  it('says when there is nothing to practise', () => {
    renderWithApp(<MakeIt rng={seededRng(1)} />, { settings: { scope: { pos: [], classes: [], tenses: [], voices: [], dual: false } } })
    expect(screen.getByRole('link', { name: /settings/i })).toBeInTheDocument()
  })
})
