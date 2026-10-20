import { type Page, expect, test } from '@playwright/test'
import adjectives from '../../data/paradigms/adjectives.json' with { type: 'json' }
import nouns from '../../data/paradigms/nouns.json' with { type: 'json' }
import verbs from '../../data/paradigms/verbs.json' with { type: 'json' }
import { greekToBeta } from '../src/lib/betacode'
import { makeParadigms } from '../src/lib/data'
import type { ParadigmFile } from '../src/lib/features'

const data = makeParadigms([nouns, adjectives, verbs] as unknown as ParadigmFile[])

/** Fail the test on any uncaught error or console error. */
function watch(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  return errors
}

test('home links every mode', async ({ page }) => {
  const errors = watch(page)
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'Attic Greek Morphology' })).toBeVisible()
  for (const name of ['Parse it', 'Fill the table', 'Make it', 'Endings sprint']) {
    await expect(page.getByRole('main').getByRole('link', { name })).toBeVisible()
  }
  expect(errors).toEqual([])
})

test('Parse it: a round with number keys and Enter', async ({ page }) => {
  const errors = watch(page)
  await page.goto('/#/parse')
  const form = await page.getByTestId('form').textContent()
  for (let i = 0; i < 5; i++) await page.keyboard.press('1')
  await page.keyboard.press('Enter')
  const feedback = page.getByRole('region', { name: 'Feedback' })
  await expect(feedback).toBeVisible()
  await expect(feedback.getByRole('list', { name: 'Valid parses' })).toBeVisible()
  await expect(feedback.getByRole('link', { name: /grammar note/i })).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(feedback).toHaveCount(0)
  expect(await page.getByTestId('form').textContent()).toBeTruthy()
  expect(form).toBeTruthy()
  expect(errors).toEqual([])
})

test('Fill the table: type, Tab, Enter checks, Enter moves on', async ({ page }) => {
  const errors = watch(page)
  await page.goto('/#/fill')
  const blanks = page.locator('td.blank input')
  await expect(blanks.first()).toBeFocused()
  const n = await blanks.count()
  expect(n).toBeGreaterThan(0)
  for (let i = 0; i < n; i++) {
    await page.keyboard.type('xyz')
    if (i < n - 1) await page.keyboard.press('Tab')
  }
  await page.keyboard.press('Enter')
  await expect(page.getByText(new RegExp(`^\\d+ of ${n} right$`))).toBeVisible()
  await expect(page.locator('.cell-result').first()).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(page.locator('.cell-result')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('Make it: a right answer, then a wrong one explained', async ({ page }) => {
  const errors = watch(page)
  await page.goto('/#/make')
  const input = page.getByRole('textbox', { name: 'Your answer' })
  await expect(input).toBeFocused()

  const prompt = page.getByTestId('prompt')
  const lemma = data.lemma((await prompt.getAttribute('data-lemma'))!)!
  const forms = data.forms(lemma, (await prompt.getAttribute('data-cell'))!)
  await page.keyboard.type(greekToBeta(forms[0]))
  await page.keyboard.press('Enter')
  await expect(page.getByRole('region', { name: 'Feedback' }).getByText('Correct', { exact: true })).toBeVisible()
  await page.keyboard.press('Enter')

  await expect(input).toHaveValue('')
  await page.keyboard.type('xyz')
  await page.keyboard.press('Enter')
  const feedback = page.getByRole('region', { name: 'Feedback' })
  await expect(feedback.getByText('Not quite')).toBeVisible()
  await expect(feedback.getByText('Correct form:')).toBeVisible()
  await expect(feedback.locator('mark').first()).toBeVisible()
  await feedback.getByRole('link', { name: /grammar note/i }).focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/#\/notes\//)
  expect(errors).toEqual([])
})

test('Endings sprint: a 60-second round', async ({ page }) => {
  const errors = watch(page)
  await page.clock.install()
  await page.goto('/#/sprint')
  await page.getByRole('list', { name: 'Sprint sets' }).getByRole('button').first().focus()
  await page.keyboard.press('Enter')
  const input = page.getByRole('textbox', { name: 'Ending' })
  await expect(input).toBeFocused()
  await page.keyboard.type('a')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('last')).not.toBeEmpty()
  await page.clock.fastForward('01:01')
  await expect(page.getByRole('heading', { name: /time.s up/i })).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('textbox', { name: 'Ending' })).toBeVisible()
  expect(errors).toEqual([])
})

test('Settings persist across a reload', async ({ page }) => {
  await page.goto('/#/settings')
  await page.getByRole('radio', { name: /strict/i }).check()
  await page.reload()
  await expect(page.getByRole('radio', { name: /strict/i })).toBeChecked()
})

test('Review: a round, then progress survives a reload', async ({ page }) => {
  const errors = watch(page)
  await page.goto('/#/review')
  const input = page.getByRole('textbox', { name: 'Your answer' })
  await expect(input).toBeFocused()
  await expect(page.getByText(/0 to review · 20 new/)).toBeVisible()
  await page.keyboard.type('xyz')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('region', { name: 'Feedback' })).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(page.getByText(/1 to review · 19 new/)).toBeVisible() // the missed one comes back

  await page.goto('/#/stats')
  await expect(page.getByText('Answers').locator('..')).toContainText('1')
  await page.reload()
  await expect(page.getByText('Answers').locator('..')).toContainText('1')
  await expect(page.getByText('Day streak').locator('..')).toContainText('1')
  await expect(page.locator('table.heat-map').first()).toBeVisible()
  expect(errors).toEqual([])
})

test('the app still works when localStorage throws', async ({ page }) => {
  await page.addInitScript(() => {
    const fail = () => {
      throw new DOMException('denied', 'SecurityError')
    }
    Object.defineProperty(window, 'localStorage', { get: fail, configurable: true })
  })
  const errors = watch(page)
  await page.goto('/#/make')
  await page.getByRole('textbox', { name: 'Your answer' }).focus()
  await page.keyboard.type('xyz')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('region', { name: 'Feedback' })).toBeVisible()
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Progress' }).click()
  await expect(page.getByText(/not saving your progress/i)).toBeVisible()
  await expect(page.getByText('Answers').locator('..')).toContainText('1')
  expect(errors).toEqual([])
})
