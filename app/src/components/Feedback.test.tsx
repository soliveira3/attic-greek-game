import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { checkAnswer } from '../lib/check'
import type { Cell } from '../lib/data'
import { MACRON, stripAccents } from '../lib/normalize'
import { testData } from '../test/data'
import { renderWithApp } from '../test/render'
import { Feedback } from './Feedback'

const logos = testData.lemma('noun:λόγος')!
const gen = testData.forms(logos, 'gen.sg')
const dat = testData.forms(logos, 'dat.sg')
const allCells: Cell[] = testData.lemmas.flatMap((l) => l.cells as Cell[])

describe('Feedback', () => {
  it('explains a wrong answer and offers the note and Next', async () => {
    const onNext = vi.fn()
    const result = checkAnswer(dat[0], gen, 'ignore-accents', { stemLength: testData.checkContext(logos, 'gen.sg').stemLength })
    const { container } = renderWithApp(<Feedback result={result} forms={gen} topic="decl2" onNext={onNext} />)
    expect(screen.getByText('Not quite')).toBeInTheDocument()
    expect(screen.getByText('The ending is wrong.')).toBeInTheDocument()
    expect(screen.getByText('Correct form:')).toBeInTheDocument()
    expect(container.querySelectorAll('mark').length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: /2nd declension/i })).toHaveAttribute('href', '#/notes/decl2')
    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(onNext).toHaveBeenCalled()
  })
  it('keeps a right answer short', () => {
    renderWithApp(<Feedback result={checkAnswer(gen[0], gen, 'strict')} forms={gen} topic="decl2" />)
    expect(screen.getByText('Correct')).toBeInTheDocument()
    expect(screen.queryByText('Correct form:')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /next/i })).not.toBeInTheDocument()
  })
  it('shows what was forgiven', () => {
    const plain = stripAccents(gen[0])
    renderWithApp(<Feedback result={checkAnswer(plain, gen, 'ignore-accents')} forms={gen} topic="decl2" />)
    expect(screen.getByText('Correct')).toBeInTheDocument()
    expect(screen.getByText(/check the accent/)).toBeInTheDocument()
    expect(screen.getByText('Correct form:')).toBeInTheDocument()
  })
  it('lists the other accepted forms', () => {
    const cell = allCells.map((c) => ({ c })).find(({ c }) => c.forms.length > 1)!
    renderWithApp(<Feedback result={checkAnswer('', cell.c.forms, 'strict')} forms={cell.c.forms} topic="decl2" />)
    expect(screen.getByText('No answer')).toBeInTheDocument()
    expect(screen.getByText(/also right/i)).toHaveTextContent(cell.c.forms[1])
  })
  it('hides length marks when the setting says so', () => {
    const cell = allCells.find((c) => c.forms.length === 1 && c.forms[0].normalize('NFD').includes(MACRON))!
    const { container } = renderWithApp(<Feedback result={checkAnswer('', cell.forms, 'strict')} forms={cell.forms} topic="decl1" />, {
      settings: { lengthMarks: false },
    })
    expect(container.textContent!.normalize('NFD')).not.toContain(MACRON)
  })
})
