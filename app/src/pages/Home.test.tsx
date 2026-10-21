import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { UNITS, completeLesson, emptyPath, savePath } from '../lib/path'
import { createStore } from '../lib/storage'
import { renderWithApp } from '../test/render'
import { Home } from './Home'

describe('Home (the path)', () => {
  it('shows every unit with its guidebook', () => {
    renderWithApp(<Home />)
    expect(screen.getByRole('heading', { level: 1, name: 'Your path' })).toBeInTheDocument()
    const units = document.querySelectorAll<HTMLElement>('section.unit')
    expect([...units].map((u) => u.querySelector('h2')?.textContent)).toEqual(UNITS.map((u) => u.title))
    units.forEach((unit, i) => expect(within(unit).getByText('Guidebook').closest('a')).toHaveAttribute('href', `#/notes/${UNITS[i].note}`))
  })

  it('opens the first lesson and keeps later ones locked, except unit tests', () => {
    renderWithApp(<Home />)
    expect(screen.getByRole('link', { name: /^start lesson/i })).toHaveAttribute('href', '#/lesson/article.1')
    const unit = screen.getByRole('region', { name: '2nd declension' })
    expect(within(unit).queryByRole('link', { name: /build the form/i })).not.toBeInTheDocument()
    expect(within(unit).getByText('Build the form').closest('.node')).toHaveTextContent(/locked: build the form/i)
    expect(within(unit).getByRole('link', { name: /jump here/i })).toHaveAttribute('href', '#/lesson/decl2.5')
  })

  it('moves on as lessons are done, and lets done ones be replayed', () => {
    const store = createStore(null)
    savePath(store, completeLesson(emptyPath(), 'article.1', { right: 8, total: 8 }, Date.now()))
    renderWithApp(<Home />, { store })
    expect(screen.getByText('Start lesson')).toHaveAttribute('href', '#/lesson/article.2')
    const unit = document.querySelector<HTMLElement>('section.unit')!
    expect(within(unit).getByRole('link', { name: /done, practise again: ?spot the form/i })).toHaveAttribute('href', '#/lesson/article.1')
    expect(within(unit).getByText('1 of 5')).toBeInTheDocument()
  })

  it('says what Review has today', () => {
    renderWithApp(<Home />)
    expect(screen.getByText(/0 due, 20 new today/)).toBeInTheDocument()
  })
})
