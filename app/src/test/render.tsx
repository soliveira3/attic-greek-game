// Render a component inside the app's providers, with the real data and a memory store.

import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { AppProvider } from '../app/AppContext'
import { TypingProvider } from '../components/typing'
import { DEFAULT_SETTINGS, type Settings, saveSettings } from '../lib/settings'
import { type Store, createStore } from '../lib/storage'
import { testData } from './data'

export function renderWithApp(ui: ReactElement, opts: { store?: Store; settings?: Partial<Settings> } = {}) {
  const store = opts.store ?? createStore(null)
  if (opts.settings) saveSettings(store, { ...DEFAULT_SETTINGS, ...opts.settings })
  const result = render(
    <AppProvider store={store} data={testData}>
      <TypingProvider>{ui}</TypingProvider>
    </AppProvider>,
  )
  return { ...result, store }
}
