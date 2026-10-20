import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { loadSettings } from '../lib/settings'
import { createStore } from '../lib/storage'
import { testData } from '../test/data'
import { AppProvider, useApp } from './AppContext'

function Probe() {
  const { data, settings, setSettings } = useApp()
  return (
    <div>
      <p>{data.lemmas.length} lemmas</p>
      <p>strictness: {settings.strictness}</p>
      <button onClick={() => setSettings({ ...settings, strictness: 'strict' })}>strict</button>
    </div>
  )
}

describe('AppProvider', () => {
  it('provides data given up front', () => {
    render(
      <AppProvider store={createStore(null)} data={testData}>
        <Probe />
      </AppProvider>,
    )
    expect(screen.getByText(`${testData.lemmas.length} lemmas`)).toBeInTheDocument()
  })
  it('shows a loading state, then the app', async () => {
    render(
      <AppProvider store={createStore(null)} load={() => Promise.resolve(testData)}>
        <Probe />
      </AppProvider>,
    )
    expect(screen.getByRole('status')).toHaveTextContent(/loading/i)
    expect(await screen.findByText(`${testData.lemmas.length} lemmas`)).toBeInTheDocument()
  })
  it('reports a failed load and retries', async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(testData)
    render(
      <AppProvider store={createStore(null)} load={load}>
        <Probe />
      </AppProvider>,
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load/i)
    await userEvent.click(screen.getByRole('button', { name: /try again/i }))
    expect(await screen.findByText(`${testData.lemmas.length} lemmas`)).toBeInTheDocument()
    expect(load).toHaveBeenCalledTimes(2)
  })
  it('loads settings from the store and saves changes', async () => {
    const store = createStore(null)
    store.write('settings', { strictness: 'lenient' })
    render(
      <AppProvider store={store} data={testData}>
        <Probe />
      </AppProvider>,
    )
    expect(screen.getByText('strictness: lenient')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'strict' }))
    expect(screen.getByText('strictness: strict')).toBeInTheDocument()
    expect(loadSettings(store).strictness).toBe('strict')
  })
  it('refuses to be used outside the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Probe />)).toThrow(/AppProvider/)
    vi.restoreAllMocks()
  })
})
