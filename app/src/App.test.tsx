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
  it('opens on the path', () => {
    render(<App store={createStore(null)} data={testData} />)
    expect(screen.getByRole('heading', { level: 1, name: 'Your path' })).toBeInTheDocument()
  })
  it('links every section from the navigation, and every mode from Practice', () => {
    render(<App store={createStore(null)} data={testData} />)
    const nav = screen.getByRole('navigation', { name: 'Main' })
    for (const name of ['Learn', 'Review', 'Practice', 'Progress', 'Notes', 'Settings']) {
      expect(within(nav).getByRole('link', { name })).toBeInTheDocument()
    }
    go('#/practice')
    for (const name of ['Parse it', 'Fill the table', 'Make it', 'Endings sprint']) {
      expect(within(screen.getByRole('main')).getByRole('link', { name: new RegExp(name) })).toBeInTheDocument()
    }
    go('#/make')
    expect(within(nav).getByRole('link', { name: 'Practice' })).toHaveAttribute('aria-current', 'page')
  })
  it('plays a lesson full screen, without the navigation', () => {
    render(<App store={createStore(null)} data={testData} />)
    go('#/lesson/article.1')
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: /lesson progress/i })).toBeInTheDocument()
  })
  it('shows today’s streak, XP and reviews', () => {
    render(<App store={createStore(null)} data={testData} />)
    expect(screen.getAllByRole('list', { name: 'Today' })[0]).toHaveTextContent(/0 day streak.*0 XP today.*0 reviews due/)
  })
  it('shows the page of the current hash and marks it in the navigation', () => {
    render(<App store={createStore(null)} data={testData} />)
    go('#/settings')
    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toHaveFocus()
    expect(within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', { name: 'Settings' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    go('#/make')
    expect(screen.getByRole('textbox', { name: /your answer/i })).toHaveFocus()
    go('#/notes/augment')
    expect(screen.getByRole('heading', { level: 1, name: 'The augment' })).toBeInTheDocument()
    go('#/nowhere')
    expect(screen.getByRole('heading', { level: 1, name: /not found/i })).toBeInTheDocument()
  })
  it('shows what Review has today on the home page', () => {
    render(<App store={createStore(null)} data={testData} />)
    expect(screen.getByText(/0 due, 20 new today/)).toBeInTheDocument()
  })
  it('credits the data sources', () => {
    render(<App store={createStore(null)} data={testData} />)
    const footer = screen.getByRole('contentinfo')
    expect(within(footer).getByRole('link', { name: 'Wiktionary' })).toBeInTheDocument()
    expect(footer).toHaveTextContent(/CC BY-SA/)
  })
  it('gives a typing example taken from the data', () => {
    render(<App store={createStore(null)} data={testData} />)
    go('#/practice')
    const verb = testData.lemmas.find((l) => l.pos === 'verb')!
    expect(screen.getByText(verb.lemma, { exact: false })).toBeInTheDocument()
  })
})
