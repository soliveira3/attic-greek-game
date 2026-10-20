import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { loadAttempts } from '../lib/attempts'
import type { Cell } from '../lib/data'
import type { Lemma } from '../lib/features'
import { key } from '../lib/normalize'
import { seededRng } from '../lib/prompts'
import { testData } from '../test/data'
import { renderWithApp } from '../test/render'
import { ParseIt } from './ParseIt'

/** The word and form on screen, and every valid parse of it. */
function shown(): { lemma: Lemma; form: string; parses: Cell[] } {
  const form = screen.getByTestId('form').textContent!
  const ref = screen.getByTestId('prompt').dataset.lemma!
  const lemma = testData.lemma(ref)!
  return { lemma, form, parses: testData.parsesOf(lemma, form) }
}

function option(group: string, label: string) {
  return within(screen.getByRole('group', { name: group })).getByRole('button', { name: new RegExp(`^\\d ${label}$`) })
}

const NOUNS = { scope: { pos: ['noun' as const], classes: [], tenses: [], voices: [], dual: false } }

describe('ParseIt', () => {
  it('shows a form with its word and gloss', () => {
    renderWithApp(<ParseIt rng={seededRng(1)} />, { settings: NOUNS })
    const { lemma, parses } = shown()
    expect(screen.getByTestId('prompt')).toHaveTextContent(lemma.gloss)
    expect(parses.length).toBeGreaterThan(0)
    expect(screen.getByRole('group', { name: 'Case' })).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Gender' })).not.toBeInTheDocument()
  })
  it('accepts a valid parse picked with the mouse and records it', async () => {
    const { store } = renderWithApp(<ParseIt rng={seededRng(2)} />, { settings: NOUNS })
    const { parses } = shown()
    const p = parses[0] as Extract<Cell, { case: string }>
    await userEvent.click(option('Case', { nom: 'nominative', gen: 'genitive', dat: 'dative', acc: 'accusative', voc: 'vocative' }[p.case]))
    await userEvent.click(option('Number', p.number === 'sg' ? 'singular' : 'plural'))
    await userEvent.click(screen.getByRole('button', { name: /check/i }))
    expect(screen.getByText('Correct')).toBeInTheDocument()
    const [a] = loadAttempts(store)
    expect(a).toMatchObject({ correct: true, mode: 'parse', errorKind: null })
    expect(a.itemKey.endsWith(`|${p.key}`)).toBe(true)
  })
  it('explains a wrong parse, lists the valid ones and links the note', async () => {
    const { store } = renderWithApp(<ParseIt rng={seededRng(3)} />, { settings: NOUNS })
    const { parses } = shown()
    const cases = ['nom', 'gen', 'dat', 'acc', 'voc']
    const wrongCase = cases.find((c) => !parses.some((p) => 'case' in p && p.case === c))!
    const names: Record<string, string> = { nom: 'nominative', gen: 'genitive', dat: 'dative', acc: 'accusative', voc: 'vocative' }
    await userEvent.click(option('Case', names[wrongCase]))
    await userEvent.click(option('Number', 'singular'))
    await userEvent.keyboard('{Enter}')
    expect(screen.getByText('Not quite')).toBeInTheDocument()
    const list = screen.getByRole('list', { name: /valid parses/i })
    expect(within(list).getAllByRole('listitem')).toHaveLength(parses.length)
    expect(screen.getByRole('link', { name: /grammar note/i })).toBeInTheDocument()
    expect(loadAttempts(store)[0]).toMatchObject({ correct: false, errorKind: 'parse' })
  })
  it('plays with number keys and Enter alone', async () => {
    const { store } = renderWithApp(<ParseIt rng={seededRng(4)} />, { settings: NOUNS })
    const first = shown()
    const p = first.parses[0] as Extract<Cell, { case: string }>
    const caseDigit = ['nom', 'gen', 'dat', 'acc', 'voc'].indexOf(p.case) + 1
    await userEvent.keyboard(`${caseDigit}${p.number === 'sg' ? 1 : 2}{Enter}`)
    expect(screen.getByText('Correct')).toBeInTheDocument()
    await userEvent.keyboard('{Enter}')
    expect(screen.queryByText('Correct')).not.toBeInTheDocument()
    expect(loadAttempts(store)).toHaveLength(1)
    expect(screen.getByText(/1 of 1 right/)).toBeInTheDocument()
  })
  it('asks for every group before checking', async () => {
    renderWithApp(<ParseIt rng={seededRng(5)} />, { settings: NOUNS })
    await userEvent.keyboard('1{Enter}')
    expect(screen.getByRole('alert')).toHaveTextContent(/number/i)
  })
  it('asks verbs for tense, voice, mood, person and number, and skips person and number for an infinitive', async () => {
    renderWithApp(<ParseIt rng={seededRng(6)} />, { settings: { scope: { pos: ['verb'], classes: [], tenses: ['pres'], voices: ['act'], dual: false } } })
    for (const g of ['Tense', 'Voice', 'Mood', 'Person', 'Number']) expect(screen.getByRole('group', { name: g })).toBeInTheDocument()
    await userEvent.click(option('Mood', 'infinitive'))
    expect(option('Person', '1st person')).toBeDisabled()
  })
  it('accepts the dual only when it is drilled', () => {
    renderWithApp(<ParseIt rng={seededRng(7)} />, { settings: { scope: { ...NOUNS.scope, dual: true } } })
    expect(option('Number', 'dual')).toBeInTheDocument()
  })
  it('says when there is nothing to practise', () => {
    renderWithApp(<ParseIt rng={seededRng(1)} />, { settings: { scope: { pos: [], classes: [], tenses: [], voices: [], dual: false } } })
    expect(screen.getByRole('link', { name: /settings/i })).toBeInTheDocument()
  })
  it('shows the form as stored, matching a valid cell', () => {
    renderWithApp(<ParseIt rng={seededRng(8)} />)
    const { form, parses } = shown()
    expect(parses.some((c) => c.forms.some((f) => key(f) === key(form)))).toBe(true)
  })
})
