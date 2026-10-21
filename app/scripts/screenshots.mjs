// Screenshots for the README (docs/images/), taken from the built site.
// Usage: npm run screenshots   (builds first; needs `npx playwright install chromium` once)

import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium, devices } from '@playwright/test'
import { preview } from 'vite'

const OUT = fileURLToPath(new URL('../../docs/images/', import.meta.url))
mkdirSync(OUT, { recursive: true })

const server = await preview({ preview: { port: 4175, strictPort: true } })
const base = 'http://localhost:4175/'
const browser = await chromium.launch()

async function shot(name, { scheme = 'light', device = devices['Desktop Chrome'], viewport, path = '', act } = {}) {
  const context = await browser.newContext({ ...device, ...(viewport ? { viewport } : {}), colorScheme: scheme })
  // sounds off, so nothing plays while the screenshots are taken
  await context.addInitScript(() => {
    if (!localStorage.getItem('settings')) localStorage.setItem('settings', JSON.stringify({ sound: false }))
  })
  const page = await context.newPage()
  await page.goto(base + path)
  await page.getByRole('heading', { level: 1 }).first().waitFor()
  if (act) await act(page)
  await page.waitForLoadState('networkidle')
  await page.screenshot({ path: `${OUT}${name}.png` })
  await context.close()
  console.log(`docs/images/${name}.png`)
}

const wrongAnswer = async (page) => {
  // a Build-the-form exercise answered wrong, to show the feedback
  for (let i = 0; i < 12; i++) {
    const box = page.getByRole('textbox', { name: 'Your answer' })
    if (await box.isVisible().catch(() => false)) {
      await box.fill('xyz')
      await page.keyboard.press('Enter')
      await page.getByRole('region', { name: 'Feedback' }).waitFor()
      return
    }
    // a Spot-the-form exercise: answer it and move on
    await page.keyboard.press('1')
    await page.keyboard.press('Enter')
    await page.keyboard.press('Enter')
  }
}

const desktop = { viewport: { width: 1280, height: 800 } }
await shot('path-light', { ...desktop })
await shot('path-dark', { ...desktop, scheme: 'dark' })
await shot('lesson-feedback-light', { ...desktop, path: '#/lesson/decl2.2', act: wrongAnswer })
await shot('lesson-feedback-dark', { ...desktop, scheme: 'dark', path: '#/lesson/decl2.2', act: wrongAnswer })
await shot('note-phone', { device: devices['Pixel 7'], path: '#/notes/decl2' })

await browser.close()
await new Promise((resolve) => server.httpServer.close(resolve))
