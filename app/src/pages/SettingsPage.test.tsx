import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { NOUN_CLASSES } from '../lib/features'
import { loadSettings } from '../lib/settings'
import { renderWithApp } from '../test/render'
import { SettingsPage } from './SettingsPage'

describe('SettingsPage', () => {
  it('shows the defaults', () => {
    renderWithApp(<SettingsPage />)
    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /ignore accents/i })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Verbs' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: /include the dual/i })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: /vowel-length marks/i })).toBeChecked()
  })
  it('saves the strictness', async () => {
    const { store } = renderWithApp(<SettingsPage />)
    await userEvent.click(screen.getByRole('radio', { name: /strict/i }))
    expect(loadSettings(store).strictness).toBe('strict')
  })
  it('saves parts of speech, tenses, voices, the dual and length marks', async () => {
    const { store } = renderWithApp(<SettingsPage />)
    await userEvent.click(screen.getByRole('checkbox', { name: 'Verbs' }))
    await userEvent.click(screen.getByRole('checkbox', { name: 'perfect' }))
    await userEvent.click(screen.getByRole('checkbox', { name: 'passive' }))
    await userEvent.click(screen.getByRole('checkbox', { name: /include the dual/i }))
    await userEvent.click(screen.getByRole('checkbox', { name: /vowel-length marks/i }))
    const s = loadSettings(store)
    expect(s.scope.pos).not.toContain('verb')
    expect(s.scope.tenses).not.toContain('perf')
    expect(s.scope.voices).not.toContain('pass')
    expect(s.scope.dual).toBe(true)
    expect(s.lengthMarks).toBe(false)
    await userEvent.click(screen.getByRole('checkbox', { name: 'Verbs' }))
    expect(loadSettings(store).scope.pos).toContain('verb')
  })
  it('narrows the classes, and stores "every class" as an empty list', async () => {
    const { store } = renderWithApp(<SettingsPage />)
    const third = screen.getByRole('group', { name: '3rd declension' })
    const boxes = within(third).getAllByRole('checkbox')
    expect(boxes).toHaveLength(NOUN_CLASSES.filter((c) => c.startsWith('decl3')).length)
    await userEvent.click(boxes[0])
    expect(loadSettings(store).scope.classes).not.toContain('decl3-labial')
    expect(loadSettings(store).scope.classes).toContain('decl3-velar')
    await userEvent.click(boxes[0])
    expect(loadSettings(store).scope.classes).toEqual([])
  })
  it('selects only one family, or all of them again', async () => {
    const { store } = renderWithApp(<SettingsPage />)
    await userEvent.click(within(screen.getByRole('group', { name: '2nd declension' })).getByRole('button', { name: /only these/i }))
    expect(loadSettings(store).scope.classes).toEqual(['decl2-mf', 'decl2-n'])
    await userEvent.click(screen.getByRole('button', { name: /all classes/i }))
    expect(loadSettings(store).scope.classes).toEqual([])
  })
  it('saves the daily new-card limit, kept between 0 and 200', async () => {
    const { store } = renderWithApp(<SettingsPage />)
    const box = screen.getByRole('spinbutton', { name: /new words a day/i })
    expect(box).toHaveValue(20)
    await userEvent.clear(box)
    await userEvent.type(box, '35')
    expect(loadSettings(store).newPerDay).toBe(35)
    await userEvent.type(box, '0')
    expect(loadSettings(store).newPerDay).toBe(200)
  })
  it('warns when the scope leaves nothing to practise', async () => {
    renderWithApp(<SettingsPage />, { settings: { scope: { pos: [], classes: [], tenses: [], voices: [], dual: false } } })
    expect(screen.getByRole('status')).toHaveTextContent(/nothing to practise/i)
  })
  it('counts the words in scope', () => {
    renderWithApp(<SettingsPage />)
    expect(screen.getByRole('status')).toHaveTextContent(/\d+ words in scope/)
  })
})
