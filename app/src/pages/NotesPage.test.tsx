import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { NOTE_TITLES, NOTE_TOPICS } from '../lib/notes'
import { testData } from '../test/data'
import { renderWithApp } from '../test/render'
import { NotesPage } from './NotesPage'

describe('NotesPage', () => {
  it('lists every note', () => {
    renderWithApp(<NotesPage />)
    expect(screen.getByRole('heading', { level: 1, name: 'Grammar notes' })).toBeInTheDocument()
    for (const t of NOTE_TOPICS) expect(screen.getByRole('link', { name: NOTE_TITLES[t] })).toHaveAttribute('href', `#/notes/${t}`)
  })
  it('shows a note with its tables and forms drawn from the data', () => {
    renderWithApp(<NotesPage topic="decl2" />)
    expect(screen.getByRole('heading', { level: 1, name: NOTE_TITLES.decl2 })).toBeInTheDocument()
    const logos = testData.lemma('noun:λόγος')!
    const table = screen.getAllByRole('table')[0]
    expect(table.textContent).toContain(testData.forms(logos, 'gen.pl')[0])
    expect(screen.getByRole('link', { name: /accents and breathings/i })).toHaveAttribute('href', '#/notes/accent')
    expect(screen.getAllByText(/Smyth §/).length).toBeGreaterThan(0)
  })
  it('shows a form shared by several cells once, naming the cells on hover', () => {
    const { container } = renderWithApp(<NotesPage topic="decl3-iu" />)
    const polis = testData.lemma('noun:πόλις')!
    const shared = [...container.querySelectorAll('p span[title], li span[title]')].find((el) => el.getAttribute('title')!.includes(';'))!
    expect(shared.textContent).toBe(testData.forms(polis, 'nom.pl')[0])
  })
  it('sets the ending off in tables of the verified models', () => {
    const { container } = renderWithApp(<NotesPage topic="decl2" />)
    expect(container.querySelectorAll('table .ending').length).toBeGreaterThan(0)
  })
  it('shows principal parts as a table', () => {
    renderWithApp(<NotesPage topic="principal-parts" />)
    const parts = screen.getByRole('table', { name: /principal parts/i })
    expect(within(parts).getAllByRole('row').length).toBeGreaterThan(3)
    expect(within(parts).getByRole('columnheader', { name: /aorist passive/i })).toBeInTheDocument()
  })
  it('says when there is no such note', () => {
    renderWithApp(<NotesPage topic="nonsense" />)
    expect(screen.getByText(/no note/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /all notes/i })).toHaveAttribute('href', '#/notes')
  })
})
