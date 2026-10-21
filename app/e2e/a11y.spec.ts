import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

// Automated accessibility checks (WCAG 2.1 A/AA rules axe can test) on every page, in both themes.
// Reduced motion turns the app's animations off, so axe measures settled colours, not a frame of
// the feedback sheet fading in (slower CI machines caught it mid-animation).
test.use({ reducedMotion: 'reduce' })
const PAGES = ['/', '/#/practice', '/#/lesson/article.1', '/#/lesson/perf.2', '/#/placement', '/#/unit/decl3s', '/#/review', '/#/parse', '/#/fill', '/#/make', '/#/sprint', '/#/stats', '/#/settings', '/#/notes', '/#/notes/decl1', '/#/notes/principal-parts']

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`${scheme} theme`, () => {
    test.use({ colorScheme: scheme })
    for (const path of PAGES) {
      test(`no accessibility violations on ${path}`, async ({ page }) => {
        await page.goto(path)
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
        const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
        expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(', ')}`)).toEqual([])
      })
    }
  })
}

for (const scheme of ['light', 'dark'] as const) {
  test(`no accessibility violations in feedback (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme })
    const check = async () => {
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(', ')}`)).toEqual([])
    }
    await page.goto('/#/make')
    await page.getByRole('textbox', { name: 'Your answer' }).fill('xyz')
    await page.keyboard.press('Enter')
    await expect(page.getByRole('region', { name: 'Feedback' })).toBeVisible()
    await check()
    await page.goto('/#/fill')
    await page.locator('td.blank input').first().focus()
    await page.keyboard.press('Enter')
    await expect(page.locator('.cell-result').first()).toBeVisible()
    await check()
    await page.goto('/#/parse')
    await expect(page.getByTestId('form')).toBeVisible()
    for (let i = 0; i < 5; i++) await page.keyboard.press('1')
    await page.keyboard.press('Enter')
    await expect(page.getByRole('region', { name: 'Feedback' })).toBeVisible()
    await check()
  })
}
