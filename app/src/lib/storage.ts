// A small JSON store over localStorage. Every access is wrapped in try/catch: in private
// windows, with storage disabled or full, values live in memory for the session instead.

export interface Store {
  read<T>(key: string, fallback: T): T
  write(key: string, value: unknown): void
  remove(key: string): void
  /** False once the backing storage has failed (progress then lasts only this session). */
  readonly persistent: boolean
}

export function createStore(backing: Storage | null | undefined): Store {
  // what this session wrote (null: removed); it wins over the backing storage, which may be stale
  // once a write has failed
  const memory = new Map<string, string | null>()
  let persistent = Boolean(backing)
  const attempt = <T>(fn: () => T): T | undefined => {
    if (!backing) return undefined
    try {
      return fn()
    } catch {
      persistent = false
      return undefined
    }
  }
  return {
    read<T>(key: string, fallback: T): T {
      // keys this session has not touched are still read from the backing storage after a write
      // fails (a full storage must not hide the progress saved before)
      const raw = memory.has(key) ? memory.get(key)! : (attempt(() => backing!.getItem(key)) ?? null)
      if (raw === null) return fallback
      try {
        return JSON.parse(raw) as T
      } catch {
        return fallback
      }
    },
    write(key, value) {
      const raw = JSON.stringify(value)
      memory.set(key, raw)
      if (persistent) attempt(() => backing!.setItem(key, raw))
    },
    remove(key) {
      memory.set(key, null)
      if (persistent) attempt(() => backing!.removeItem(key))
    },
    get persistent() {
      return persistent
    },
  }
}

/** The browser's localStorage, or null where even touching it throws. */
export function browserStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}
