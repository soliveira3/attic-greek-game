import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { loadAttempts } from '../lib/attempts'
import { greekToBeta } from '../lib/betacode'
import { cellLabel } from '../lib/features'
import { seededRng } from '../lib/prompts'
import { testData } from '../test/data'
import { renderWithApp } from '../test/render'
import { FillTable } from './FillTable'

const NOUNS = { scope: { pos: ['noun' as const], classes: [], tenses: [], voices: [], dual: false } }

function lemmaShown() {
  return testData.lemma(screen.getByTestId('table').dataset.lemma!)!
}

function blanks() {
  return screen.getAllByRole('textbox') as HTMLInputElement[]
}

/** Type the right form (in beta code, as a player would) into a blank. */
async function fill(input: HTMLInputElement, cellKey: string) {
  const form = testData.forms(lemmaShown(), cellKey)[0]
  await userEvent.type(input, greekToBeta(form))
}

describe('FillTable', () => {
  it('shows a paradigm grid with a few blanks by default', () => {
    renderWithApp(<FillTable rng={seededRng(1)} />, { settings: NOUNS })
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(blanks()).toHaveLength(3)
    expect(screen.getByRole('radio', { name: /a few/i })).toBeChecked()
  })
  it('blanks half or all of the table on request', async () => {
    renderWithApp(<FillTable rng={seededRng(1)} />, { settings: NOUNS })
    await userEvent.click(screen.getByRole('radio', { name: /^all/i }))
    const cells = screen.getByRole('table').querySelectorAll('tbody td').length
    expect(blanks()).toHaveLength(cells)
  })
  it('checks every cell with Enter, records each and marks the wrong ones', async () => {
    const { store } = renderWithApp(<FillTable rng={seededRng(2)} />, { settings: NOUNS })
    const inputs = blanks()
    const keyOf = (i: HTMLInputElement) => i.dataset.cell!
    await fill(inputs[0], keyOf(inputs[0]))
    await userEvent.type(inputs[1], 'xyz')
    // the third is left empty
    await userEvent.type(inputs[0], '{Enter}')
    expect(screen.getByText('1 of 3 right')).toBeInTheDocument()
    const attempts = loadAttempts(store)
    expect(attempts.map((a) => a.correct)).toEqual([true, false, false])
    expect(attempts.map((a) => a.errorKind)).toContain('blank')
    expect(attempts.every((a) => a.mode === 'fill')).toBe(true)
    expect(screen.getByTestId(`result-${keyOf(inputs[1])}`)).toHaveTextContent(/wrong/i)
    expect(screen.getByRole('link', { name: /grammar note/i })).toBeInTheDocument()
  })
  it('labels each blank with its cell', () => {
    renderWithApp(<FillTable rng={seededRng(3)} />, { settings: NOUNS })
    for (const input of blanks()) expect(input).toHaveAccessibleName(cellLabel(input.dataset.cell!))
  })
  it('moves on to a new table with Enter after checking', async () => {
    renderWithApp(<FillTable rng={seededRng(4)} />, { settings: NOUNS })
    await userEvent.type(blanks()[0], '{Enter}')
    expect(screen.getByText('0 of 3 right')).toBeInTheDocument()
    await userEvent.keyboard('{Enter}')
    expect(screen.queryByText('0 of 3 right')).not.toBeInTheDocument()
    expect(blanks()[0]).toHaveValue('')
    expect(blanks()[0]).toHaveFocus()
  })
  it('gives one tense and voice of a verb', () => {
    renderWithApp(<FillTable rng={seededRng(5)} />, { settings: { scope: { pos: ['verb'], classes: [], tenses: ['aor'], voices: ['mid'], dual: false } } })
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(/aorist middle/i)
  })
  it('says when there is nothing to practise', () => {
    renderWithApp(<FillTable rng={seededRng(1)} />, { settings: { scope: { pos: [], classes: [], tenses: [], voices: [], dual: false } } })
    expect(screen.getByRole('link', { name: /settings/i })).toBeInTheDocument()
  })
})
