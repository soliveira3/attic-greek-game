import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { type Attempt, recordAttempt } from '../lib/attempts'
import { UNITS, completeLesson, emptyPath, savePath, setPlacement } from '../lib/path'
import { createStore } from '../lib/storage'
import { renderWithApp } from '../test/render'
import { Home } from './Home'

const units = () => [...document.querySelectorAll<HTMLElement>('section.unit')]

describe('Home (the path)', () => {
  it('shows every unit with its guidebook', () => {
    renderWithApp(<Home />)
    expect(screen.getByRole('heading', { level: 1, name: 'Your path' })).toBeInTheDocument()
    expect(units().map((u) => u.querySelector('h2')?.textContent)).toEqual(UNITS.map((u) => u.title))
    units().forEach((unit, i) => expect(within(unit).getByText('Guidebook').closest('a')).toHaveAttribute('href', `#/notes/${UNITS[i].note}`))
  })

  it('opens every lesson of every unit', () => {
    renderWithApp(<Home />)
    const last = units().at(-1)!
    for (const n of [1, 2, 3, 4, 5]) {
      expect(within(last).getAllByRole('link').some((a) => a.getAttribute('href') === `#/lesson/perf.${n}`)).toBe(true)
    }
    expect(document.querySelector('.locked')).toBeNull()
  })

  it('suggests a newcomer starts at the beginning or finds their level', () => {
    renderWithApp(<Home />)
    expect(screen.getByText('Start lesson')).toHaveAttribute('href', '#/lesson/article.1')
    expect(screen.getByRole('link', { name: /find my level/i })).toHaveAttribute('href', '#/placement')
  })

  it('recommends a warm-up a little below the level found', () => {
    const store = createStore(null)
    savePath(store, setPlacement(emptyPath(), UNITS.findIndex((u) => u.id === 'pres-act'), Date.now()))
    renderWithApp(<Home />, { store })
    expect(screen.getByText('Start lesson')).toHaveAttribute('href', '#/lesson/pres-act.3')
    expect(screen.getByText(/solid up to unit 4/i)).toBeInTheDocument()
    expect(units()[3]).toHaveClass('recommended')
  })

  it('marks done lessons and lets them be replayed', () => {
    const store = createStore(null)
    savePath(store, completeLesson(emptyPath(), 'article.1', { right: 8, total: 8 }, Date.now()))
    renderWithApp(<Home />, { store })
    expect(screen.getByText('Start lesson')).toHaveAttribute('href', '#/lesson/article.2')
    const unit = units()[0]
    expect(within(unit).getByRole('link', { name: /done, practise again: ?spot the form/i })).toHaveAttribute('href', '#/lesson/article.1')
    expect(within(unit).getByText('1 of 5')).toBeInTheDocument()
  })

  it('jumps to any unit from the unit index, and to the unit in the link', async () => {
    const scroll = vi.fn()
    Element.prototype.scrollIntoView = scroll
    renderWithApp(<Home unit="decl3s" />)
    expect(document.activeElement).toHaveTextContent(UNITS.find((u) => u.id === 'decl3s')!.title)
    await userEvent.click(within(screen.getByRole('navigation', { name: 'Units' })).getByRole('button', { name: /the perfect/i }))
    expect(document.activeElement).toHaveTextContent('The perfect')
    expect(scroll).toHaveBeenCalled()
  })

  it('lists what needs practice', () => {
    const store = createStore(null)
    const miss: Attempt = { itemKey: 'x|y', featureKey: 'decl2-mf:gen.pl', correct: false, errorKind: 'ending', ts: Date.now(), mode: 'make' }
    for (let i = 0; i < 3; i++) recordAttempt(store, miss)
    renderWithApp(<Home />, { store })
    expect(screen.getByRole('region', { name: /needs practice/i })).toBeInTheDocument()
  })

  it('says what Review has today', () => {
    renderWithApp(<Home />)
    expect(screen.getByText(/0 due, 20 new today/)).toBeInTheDocument()
  })
})
