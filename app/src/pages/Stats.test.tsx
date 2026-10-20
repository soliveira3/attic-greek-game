import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadAttempts } from '../lib/attempts'
import { answer, exportProgress } from '../lib/progress'
import { Grade } from '../lib/srs'
import { type Store, createStore } from '../lib/storage'
import { renderWithApp } from '../test/render'
import { Stats } from './Stats'

function played(store: Store = createStore(null)) {
  const now = Date.now()
  answer(store, { itemKey: 'noun:x|gen.sg', featureKey: 'decl2-mf:gen.sg', correct: true, errorKind: null, ts: now, mode: 'make' }, Grade.Good)
  answer(store, { itemKey: 'noun:x|gen.sg', featureKey: 'decl2-mf:gen.sg', correct: false, errorKind: 'ending', ts: now, mode: 'make' }, Grade.Again)
  return store
}

describe('Stats', () => {
  afterEach(() => vi.restoreAllMocks())
  it('shows the streak, what is due and overall accuracy', () => {
    renderWithApp(<Stats />, { store: played() })
    expect(screen.getByText(/day streak/i).parentElement).toHaveTextContent('1')
    expect(screen.getByText(/due today/i).parentElement).toHaveTextContent('1')
    expect(screen.getByText(/answers/i).parentElement).toHaveTextContent('2')
  })
  it('draws a heat map for each class played, with the numbers as text', () => {
    renderWithApp(<Stats />, { store: played() })
    const map = screen.getByRole('table', { name: /2nd declension, masculine/i })
    const cell = within(map).getByText('50%')
    expect(cell.closest('td')).toHaveTextContent('1/2')
    expect(screen.queryByRole('table', { name: /1st declension/i })).not.toBeInTheDocument()
  })
  it('invites a first game when nothing has been played', () => {
    renderWithApp(<Stats />)
    expect(screen.getByText(/no answers yet/i)).toBeInTheDocument()
  })
  it('exports progress as a file', async () => {
    const create = vi.fn(() => 'blob:x')
    const revoke = vi.fn()
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    renderWithApp(<Stats />, { store: played() })
    await userEvent.click(screen.getByRole('button', { name: /export/i }))
    expect(create).toHaveBeenCalled()
    expect(click).toHaveBeenCalled()
  })
  it('imports a progress file after confirmation', async () => {
    const source = played()
    const { store } = renderWithApp(<Stats />)
    const file = new File([JSON.stringify(exportProgress(source, new Date()))], 'progress.json', { type: 'application/json' })
    await userEvent.upload(screen.getByLabelText(/import/i), file)
    expect(await screen.findByText(/replaces the progress/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /replace/i }))
    expect(await screen.findByText(/imported 2 answers/i)).toBeInTheDocument()
    expect(loadAttempts(store)).toHaveLength(2)
    expect(screen.getByRole('table', { name: /2nd declension, masculine/i })).toBeInTheDocument()
  })
  it('reports a bad file and keeps the progress', async () => {
    const { store } = renderWithApp(<Stats />, { store: played() })
    await userEvent.upload(screen.getByLabelText(/import/i), new File(['{nope'], 'x.json', { type: 'application/json' }))
    await userEvent.click(await screen.findByRole('button', { name: /replace/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/not valid json/i)
    expect(loadAttempts(store)).toHaveLength(2)
  })
  it('warns when the browser is not saving progress', () => {
    const throwing = { getItem: () => { throw new Error('x') }, setItem: () => { throw new Error('x') }, removeItem: () => {} } as unknown as Storage
    const store = createStore(throwing)
    store.write('probe', 1)
    renderWithApp(<Stats />, { store })
    expect(screen.getByText(/not saving your progress/i)).toBeInTheDocument()
  })
})
