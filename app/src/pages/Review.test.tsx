import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { loadAttempts } from '../lib/attempts'
import { greekToBeta } from '../lib/betacode'
import { seededRng } from '../lib/prompts'
import { introducedOn, loadSrs } from '../lib/srs'
import { testData } from '../test/data'
import { renderWithApp } from '../test/render'
import { Review } from './Review'

function asked() {
  const el = screen.getByTestId('prompt')
  const lemma = testData.lemma(el.dataset.lemma!)!
  return { key: `${el.dataset.lemma}|${el.dataset.cell}`, forms: testData.forms(lemma, el.dataset.cell!) }
}
const input = () => screen.getByRole('textbox', { name: /your answer/i })

describe('Review', () => {
  it('works through new items in Make it format and schedules them', async () => {
    const { store } = renderWithApp(<Review rng={seededRng(1)} />, { settings: { newPerDay: 2 } })
    expect(screen.getByText(/2 new/)).toBeInTheDocument()
    await userEvent.type(input(), `${greekToBeta(asked().forms[0])}{Enter}`)
    expect(screen.getByText('Correct')).toBeInTheDocument()
    expect(loadAttempts(store)[0]).toMatchObject({ mode: 'review', correct: true })
    expect(introducedOn(loadSrs(store), new Date())).toBe(1)
    await userEvent.keyboard('{Enter}')
    expect(screen.getByText(/1 new/)).toBeInTheDocument()
  })
  it('asks a missed item again at the end of the session, once', async () => {
    renderWithApp(<Review rng={seededRng(2)} />, { settings: { newPerDay: 1 } })
    const first = asked()
    await userEvent.type(input(), 'xyz{Enter}')
    await userEvent.keyboard('{Enter}')
    expect(asked().key).toBe(first.key)
    await userEvent.type(input(), 'xyz{Enter}')
    await userEvent.keyboard('{Enter}')
    expect(screen.getByRole('heading', { name: /done for now/i })).toBeInTheDocument()
    expect(screen.getByText(/next review/i)).toBeInTheDocument()
  })
  it('says when there is nothing to review', () => {
    renderWithApp(<Review rng={seededRng(3)} />, { settings: { newPerDay: 0 } })
    expect(screen.getByRole('heading', { name: /done for now/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /make it/i })).toBeInTheDocument()
  })
})
