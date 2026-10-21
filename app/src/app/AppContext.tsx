// App-wide state: the paradigm data (loaded once), the store and the player's settings.

import { type ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { type Paradigms, loadParadigms } from '../lib/data'
import { type Settings, loadSettings, saveSettings } from '../lib/settings'
import { type Sound, playSound } from '../lib/sound'
import type { Store } from '../lib/storage'

export interface AppState {
  data: Paradigms
  store: Store
  settings: Settings
  setSettings(settings: Settings): void
  /** Goes up on every write to the store, so summaries of the progress can refresh. */
  version: number
}

const AppContext = createContext<AppState | null>(null)

export function useApp(): AppState {
  const state = useContext(AppContext)
  if (!state) throw new Error('useApp needs an AppProvider')
  return state
}

/** Plays a sound effect unless the player has switched them off. */
export function useSound(): (sound: Sound) => void {
  const { settings } = useApp()
  return useCallback((sound: Sound) => settings.sound && playSound(sound), [settings.sound])
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
  const [version, setVersion] = useState(0)
  const watched = useMemo<Store>(
    () => ({
      read: (key, fallback) => store.read(key, fallback),
      write(key, value) {
        store.write(key, value)
        setVersion((n) => n + 1)
      },
      remove(key) {
        store.remove(key)
        setVersion((n) => n + 1)
      },
      get persistent() {
        return store.persistent
      },
    }),
    [store],
  )

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
      saveSettings(watched, next)
      setSettingsState(next)
    },
    [watched],
  )

  if (!data) {
    return failed ? (
      <div className="page" role="alert">
        <p>Could not load the paradigm data. Check your connection and try again.</p>
        <button
          type="button"
          className="btn primary"
          onClick={() => {
            setFailed(false)
            setAttempt((n) => n + 1)
          }}
        >
          Try again
        </button>
      </div>
    ) : (
      <p className="page loading" role="status">
        <span className="spinner" aria-hidden="true" />
        Loading the paradigms…
      </p>
    )
  }
  return <AppContext.Provider value={{ data, store: watched, settings, setSettings, version }}>{children}</AppContext.Provider>
}
