import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { type Attempt, recordAttempt } from '../lib/attempts'
import { featureKey } from '../lib/features'
import { seededRng } from '../lib/prompts'
import { createStore } from '../lib/storage'
import { MakeIt } from '../pages/MakeIt'
import { testData } from '../test/data'
import { renderWithApp } from '../test/render'
import { WeakSpots } from './WeakSpots'

const miss = (fk: string): Attempt => ({ itemKey: `x|${fk}`, featureKey: fk, correct: false, errorKind: 'ending', ts: Date.now(), mode: 'make' })

describe('WeakSpots', () => {
  it('lists forms missed often, with the lesson and the note to go back to', () => {
    const store = createStore(null)
    for (let i = 0; i < 3; i++) recordAttempt(store, miss('decl2-mf:gen.pl'))
    renderWithApp(<WeakSpots />, { store })
    const list = screen.getByRole('region', { name: /needs practice/i })
    expect(within(list).getByText('genitive plural')).toBeInTheDocument()
    expect(within(list).getByRole('link', { name: /unit 2: build the form/i })).toHaveAttribute('href', '#/lesson/decl2.2')
    expect(within(list).getByRole('link', { name: /2nd declension/i })).toHaveAttribute('href', '#/notes/decl2')
  })
  it('shows nothing without weak spots', () => {
    const { container } = renderWithApp(<WeakSpots />)
    expect(container).toBeEmptyDOMElement()
  })
  it('points back to a lesson when a wrong answer is a form missed often', async () => {
    const store = createStore(null)
    renderWithApp(<MakeIt rng={seededRng(1)} />, { store })
    const prompt = screen.getByTestId('prompt')
    const lemma = testData.lemma(prompt.dataset.lemma!)!
    const fk = featureKey(lemma.class, prompt.dataset.cell!)
    for (let i = 0; i < 2; i++) recordAttempt(store, miss(fk))
    await userEvent.type(screen.getByRole('textbox', { name: /your answer/i }), 'xyz{Enter}')
    const feedback = screen.getByRole('region', { name: 'Feedback' })
    expect(within(feedback).getByText(/missed this form 3 times lately/i)).toBeInTheDocument()
    expect(within(feedback).getAllByRole('link').some((a) => a.getAttribute('href')?.startsWith('#/lesson/'))).toBe(true)
  })
})
