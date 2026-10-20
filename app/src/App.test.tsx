import { act, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import App from './App'
import { createStore } from './lib/storage'
import { testData } from './test/data'

function go(hash: string) {
  act(() => {
    window.location.hash = hash
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  })
}

describe('App', () => {
  afterEach(() => {
    window.location.hash = ''
  })
  it('renders the game title', () => {
    render(<App store={createStore(null)} data={testData} />)
    expect(screen.getByRole('heading', { level: 1, name: /attic greek morphology/i })).toBeInTheDocument()
  })
  it('links every mode from the navigation and the home page', () => {
    render(<App store={createStore(null)} data={testData} />)
    const nav = screen.getByRole('navigation', { name: 'Main' })
    for (const name of ['Parse it', 'Fill the table', 'Make it', 'Endings sprint', 'Notes', 'Settings']) {
      expect(within(nav).getByRole('link', { name })).toBeInTheDocument()
    }
    expect(within(screen.getByRole('main')).getAllByRole('link').length).toBeGreaterThanOrEqual(4)
  })
  it('shows the page of the current hash and marks it in the navigation', () => {
    render(<App store={createStore(null)} data={testData} />)
    go('#/settings')
    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toHaveFocus()
    expect(within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', { name: 'Settings' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    go('#/notes/augment')
    expect(screen.getByRole('heading', { level: 1, name: /grammar notes/i })).toBeInTheDocument()
    go('#/nowhere')
    expect(screen.getByRole('heading', { level: 1, name: /not found/i })).toBeInTheDocument()
  })
  it('gives a typing example taken from the data', () => {
    render(<App store={createStore(null)} data={testData} />)
    const verb = testData.lemmas.find((l) => l.pos === 'verb')!
    expect(screen.getByText(verb.lemma, { exact: false })).toBeInTheDocument()
  })
})
