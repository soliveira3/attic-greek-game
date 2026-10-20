// App-wide state: the paradigm data (loaded once), the store and the player's settings.

import { type ReactNode, createContext, useCallback, useContext, useEffect, useState } from 'react'
import { type Paradigms, loadParadigms } from '../lib/data'
import { type Settings, loadSettings, saveSettings } from '../lib/settings'
import type { Store } from '../lib/storage'

export interface AppState {
  data: Paradigms
  store: Store
  settings: Settings
  setSettings(settings: Settings): void
}

const AppContext = createContext<AppState | null>(null)

export function useApp(): AppState {
  const state = useContext(AppContext)
  if (!state) throw new Error('useApp needs an AppProvider')
  return state
}

interface Props {
  store: Store
  /** Data already loaded (tests); otherwise `load` runs once on start-up. */
  data?: Paradigms
  load?: () => Promise<Paradigms>
  children: ReactNode
}

export function AppProvider({ store, data: given, load = loadParadigms, children }: Props) {
  const [data, setData] = useState<Paradigms | null>(given ?? null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [settings, setSettingsState] = useState(() => loadSettings(store))

  useEffect(() => {
    if (data) return
    let live = true
    load().then(
      (loaded) => live && setData(loaded),
      () => live && setFailed(true),
    )
    return () => {
      live = false
    }
  }, [data, load, attempt])

  const setSettings = useCallback(
    (next: Settings) => {
      saveSettings(store, next)
      setSettingsState(next)
    },
    [store],
  )

  if (!data) {
    return failed ? (
      <div className="page" role="alert">
        <p>Could not load the paradigm data. Check your connection and try again.</p>
        <button
          onClick={() => {
            setFailed(false)
            setAttempt((n) => n + 1)
          }}
        >
          Try again
        </button>
      </div>
    ) : (
      <p className="page" role="status">
        Loading the paradigms…
      </p>
    )
  }
  return <AppContext.Provider value={{ data, store, settings, setSettings }}>{children}</AppContext.Provider>
}
