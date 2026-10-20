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
  const memory = new Map<string, string>()
  let persistent = Boolean(backing)
  const attempt = <T>(fn: () => T): T | undefined => {
    if (!persistent || !backing) return undefined
    try {
      return fn()
    } catch {
      persistent = false
      return undefined
    }
  }
  return {
    read<T>(key: string, fallback: T): T {
      const raw = memory.get(key) ?? attempt(() => backing!.getItem(key)) ?? null
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
      attempt(() => backing!.setItem(key, raw))
    },
    remove(key) {
      memory.delete(key)
      attempt(() => backing!.removeItem(key))
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
