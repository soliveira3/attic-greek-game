import { type Page, expect, test } from '@playwright/test'

// The built site runs under its Content-Security-Policy with a clean console: no errors, no
// uncaught exceptions and no blocked resources on any page.
const PAGES = ['/', '/#/practice', '/#/lesson/article.1', '/#/placement', '/#/review', '/#/parse', '/#/fill', '/#/make', '/#/sprint', '/#/stats', '/#/settings', '/#/notes', '/#/notes/decl1', '/#/notes/principal-parts', '/#/no-such-page']

function watch(page: Page): string[] {
  const problems: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(`console: ${m.text()}`)
  })
  page.on('pageerror', (e) => problems.push(`exception: ${e.message}`))
  page.on('requestfailed', (r) => problems.push(`request failed: ${r.url()}`))
  return problems
}

test('the page carries a Content-Security-Policy and a description', async ({ page }) => {
  await page.goto('/')
  const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content')
  expect(csp).toContain("default-src 'self'")
  expect(csp).toContain("object-src 'none'")
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /Attic Greek/)
})

for (const path of PAGES) {
  test(`no console errors or CSP violations on ${path}`, async ({ page }) => {
    const problems = watch(page)
    await page.addInitScript(() => {
      document.addEventListener('securitypolicyviolation', (e) => console.error(`CSP blocked ${e.violatedDirective}: ${e.blockedURI}`))
    })
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    // let lazy chunks and fonts finish
    await page.waitForLoadState('networkidle')
    expect(problems).toEqual([])
  })
}

test('a wrong answer plays its sound and shows feedback without console errors', async ({ page }) => {
  const problems = watch(page)
  await page.goto('/#/make')
  await page.getByRole('textbox', { name: 'Your answer' }).fill('xyz')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('region', { name: 'Feedback' })).toBeVisible()
  expect(problems).toEqual([])
})
