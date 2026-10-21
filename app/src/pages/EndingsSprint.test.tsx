import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadAttempts } from '../lib/attempts'
import { loadSrs } from '../lib/srs'
import { greekToBeta } from '../lib/betacode'
import { goldenModels, sprintSets } from '../lib/endings'
import { seededRng } from '../lib/prompts'
import { renderWithApp } from '../test/render'
import { EndingsSprint } from './EndingsSprint'

const sets = sprintSets(goldenModels())
const second = sets.find((s) => s.cls === 'decl2-mf')!

function current() {
  const el = screen.getByTestId('sprint-item')
  const set = sets.find((s) => s.id === el.dataset.set)!
  return { set, cell: el.dataset.cell!, endings: el.dataset.endings!.split('|') }
}

describe('EndingsSprint', () => {
  let user: ReturnType<typeof userEvent.setup>
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('lists the sets in scope with their model words', () => {
    renderWithApp(<EndingsSprint rng={seededRng(1)} />, { settings: { scope: { pos: ['noun'], classes: [], tenses: [], voices: [], dual: false } } })
    const list = screen.getByRole('list', { name: /sets/i })
    const nounSets = sets.filter((s) => !s.block && !s.cls.startsWith('adj'))
    expect(within(list).getAllByRole('button')).toHaveLength(nounSets.length)
    expect(within(list).getByRole('heading', { name: 'Nouns' })).toBeInTheDocument()
    expect(within(list).getAllByRole('button')[0]).toHaveTextContent(nounSets[0].lemma)
  })
  it('plays a 60-second round: right endings score, wrong ones show the answer', async () => {
    const { store } = renderWithApp(<EndingsSprint rng={seededRng(2)} />)
    await user.click(screen.getAllByRole('button', { name: new RegExp(second.lemma) })[0])
    const input = screen.getByRole('textbox', { name: /ending/i })
    expect(input).toHaveFocus()
    expect(screen.getByText(/60 s/)).toBeInTheDocument()

    await user.type(input, `${greekToBeta(current().endings[0])}{Enter}`)
    expect(screen.getByTestId('score')).toHaveTextContent('1')
    const before = current()
    await user.type(input, 'xyz{Enter}')
    expect(screen.getByTestId('score')).toHaveTextContent('1')
    expect(screen.getByTestId('last')).toHaveTextContent(before.endings[0])

    act(() => {
      vi.advanceTimersByTime(61_000)
    })
    expect(screen.getByRole('heading', { name: /time/i })).toBeInTheDocument()
    expect(screen.getByText(/new best/i)).toBeInTheDocument()
    const attempts = loadAttempts(store)
    expect(attempts.map((a) => a.correct)).toEqual([true, false])
    expect(attempts.every((a) => a.mode === 'sprint')).toBe(true)
    expect(attempts[1].errorKind).toBe('ending')
    expect(store.read<Record<string, number>>('sprint.best', {})[before.set.id]).toBe(1)
    expect(attempts[0].itemKey.startsWith('sprint:')).toBe(true)
    expect(loadSrs(store).cards).toEqual({})
  })
  it('plays again with Enter and goes back to the list', async () => {
    renderWithApp(<EndingsSprint rng={seededRng(3)} />)
    await user.click(screen.getAllByRole('button', { name: new RegExp(second.lemma) })[0])
    act(() => {
      vi.advanceTimersByTime(61_000)
    })
    expect(screen.getByTestId('final-score')).toHaveTextContent('0')
    await user.keyboard('{Enter}')
    expect(screen.getByRole('textbox', { name: /ending/i })).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(61_000)
    })
    await user.click(screen.getByRole('button', { name: /choose another/i }))
    expect(screen.getByRole('list', { name: /sets/i })).toBeInTheDocument()
  })
  it('says when there is nothing to practise', () => {
    renderWithApp(<EndingsSprint rng={seededRng(1)} />, { settings: { scope: { pos: [], classes: [], tenses: [], voices: [], dual: false } } })
    expect(screen.getByRole('link', { name: /settings/i })).toBeInTheDocument()
  })
})
