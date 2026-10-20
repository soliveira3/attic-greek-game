// Connects the on-screen keyboard to the answer box the player last used.

import { type ReactNode, createContext, useContext, useMemo, useRef } from 'react'

type Insert = (text: string) => void

interface Typing {
  /** Make `insert` the keyboard's target; returns a function that releases it. */
  target(insert: Insert): () => void
  insert: Insert
}

const TypingContext = createContext<Typing | null>(null)

export function useTyping(): Typing | null {
  return useContext(TypingContext)
}

export function TypingProvider({ children }: { children: ReactNode }) {
  const current = useRef<Insert | null>(null)
  const typing = useMemo<Typing>(
    () => ({
      target(insert) {
        current.current = insert
        return () => {
          if (current.current === insert) current.current = null
        }
      },
      insert: (text) => current.current?.(text),
    }),
    [],
  )
  return <TypingContext.Provider value={typing}>{children}</TypingContext.Provider>
}
