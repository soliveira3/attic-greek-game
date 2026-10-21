import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { greekToBeta } from '../lib/betacode'
import { LESSONS, completeLesson, emptyPath, findLesson, lessonDone, loadPath, savePath } from '../lib/path'
import { seededRng } from '../lib/prompts'
import { createStore } from '../lib/storage'
import { testData } from '../test/data'
import { renderWithApp } from '../test/render'
import { Lesson } from './Lesson'

/** Answers the parse exercise on screen with the first choice of every group. */
async function parseAnyway() {
  for (let i = 0; i < 5; i++) await userEvent.keyboard('1')
  await userEvent.keyboard('{Enter}')
}

async function finish() {
  for (let i = 0; i < 100 && !screen.queryByRole('heading', { name: /complete|passed|not passed/i }); i++) {
    if (screen.queryByRole('region', { name: 'Feedback' })) {
      await userEvent.keyboard('{Enter}')
      continue
    }
    const box = screen.queryByRole('textbox', { name: /your answer/i })
    if (box) {
      const prompt = screen.getByTestId('prompt')
      const lemma = testData.lemma(prompt.dataset.lemma!)!
      await userEvent.type(box, `${greekToBeta(testData.forms(lemma, prompt.dataset.cell!)[0])}{Enter}`)
    } else await parseAnyway()
  }
}

describe('Lesson', () => {
  it('shows the lesson, its progress and a way out', () => {
    renderWithApp(<Lesson id="article.1" rng={seededRng(1)} />)
    expect(screen.getByRole('heading', { level: 1, name: 'Spot the form' })).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: /lesson progress/i })).toHaveAttribute('aria-valuenow', '0')
    expect(screen.getByRole('link', { name: /quit the lesson/i })).toHaveAttribute('href', '#/unit/article')
    expect(screen.getByTestId('form')).toBeInTheDocument()
  })

  it('plays to the end, records the lesson and unlocks the next one', async () => {
    const { store } = renderWithApp(<Lesson id="article.1" rng={seededRng(1)} />)
    await finish()
    expect(screen.getByRole('heading', { name: /lesson complete/i })).toBeInTheDocument()
    expect(screen.getByText(/accuracy/i)).toBeInTheDocument()
    expect(screen.getByText('Total XP')).toBeInTheDocument()
    const path = loadPath(store)
    expect(path.log).toHaveLength(1)
    expect(path.log[0].lesson).toBe('article.1')
    expect(lessonDone(path, 'article.1')).toBe(true)
    expect(screen.getByRole('link', { name: /continue/i })).toHaveAttribute('href', '#/unit/article')
  }, 30_000)

  it('brings a missed exercise back once, at the end', async () => {
    const store = createStore(null)
    savePath(store, completeLesson(emptyPath(), 'article.1', { right: 1, total: 1 }, Date.now()))
    renderWithApp(<Lesson id="article.2" rng={seededRng(4)} />, { store })
    const bar = () => Number(screen.getByRole('progressbar', { name: /lesson progress/i }).getAttribute('aria-valuemax'))
    expect(bar()).toBe(8)
    await userEvent.type(screen.getByRole('textbox', { name: /your answer/i }), 'xyz{Enter}')
    expect(bar()).toBe(9)
    await userEvent.keyboard('{Enter}')
    expect(screen.getByRole('progressbar', { name: /lesson progress/i })).toHaveAttribute('aria-valuenow', '1')
  }, 15_000)

  it('opens any lesson, however far along the path', () => {
    renderWithApp(<Lesson id="perf.2" rng={seededRng(1)} />)
    expect(screen.getByRole('heading', { level: 1, name: 'Build the form' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /your answer/i })).toBeInTheDocument()
  })

  it('replays a lesson already done', () => {
    const store = createStore(null)
    savePath(store, completeLesson(emptyPath(), 'article.1', { right: 1, total: 1 }, Date.now()))
    renderWithApp(<Lesson id="article.1" rng={seededRng(1)} />, { store })
    expect(screen.getByTestId('form')).toBeInTheDocument()
  })

  it('says when there is no such lesson', () => {
    renderWithApp(<Lesson id="nope.9" rng={seededRng(1)} />)
    expect(screen.getByRole('heading', { name: /no such lesson/i })).toBeInTheDocument()
    expect(findLesson(LESSONS[0].id)).toBeTruthy()
  })
})
