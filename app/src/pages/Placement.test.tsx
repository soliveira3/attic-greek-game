import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { loadAttempts } from '../lib/attempts'
import { UNITS, loadPath } from '../lib/path'
import { seededRng } from '../lib/prompts'
import { renderWithApp } from '../test/render'
import { Placement } from './Placement'

/** Answers whatever is on screen wrongly, then moves on. */
async function missOne() {
  const box = screen.queryByRole('textbox', { name: /your answer/i })
  if (box) await userEvent.type(box, 'xyz{Enter}')
  else {
    // the last option of each group: wrong for most forms, and a miss either way for this test
    for (const group of screen.getAllByRole('group').filter((g) => g.closest('.option-groups'))) {
      const buttons = group.querySelectorAll('button')
      await userEvent.click(buttons[buttons.length - 1])
    }
    await userEvent.keyboard('{Enter}')
  }
  await userEvent.keyboard('{Enter}')
}

describe('Placement', () => {
  it('checks the units in path order, two exercises each, and can be left at any time', () => {
    renderWithApp(<Placement rng={seededRng(1)} />)
    expect(screen.getByRole('heading', { level: 1, name: 'Find your level' })).toBeInTheDocument()
    const bar = screen.getByRole('progressbar', { name: /placement progress/i })
    expect(bar).toHaveAttribute('aria-valuenow', '0')
    expect(bar).toHaveAttribute('aria-valuemax', String(UNITS.length))
    expect(screen.getByText(new RegExp(`unit 1 of ${UNITS.length}`, 'i'))).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /leave the check/i })).toHaveAttribute('href', '#/')
  })

  it('stops after two units with a miss, saves the level and recommends a start', async () => {
    const { store } = renderWithApp(<Placement rng={seededRng(1)} />)
    for (let i = 0; i < 4 && !screen.queryByRole('heading', { name: 'Your level' }); i++) await missOne()
    expect(screen.getByRole('heading', { name: 'Your level' })).toBeInTheDocument()
    expect(loadPath(store).placement?.level).toBe(-1)
    expect(screen.getByRole('link', { name: /start there/i })).toHaveAttribute('href', '#/lesson/article.1')
    expect(loadAttempts(store).length).toBe(4)
  }, 15_000)
})
