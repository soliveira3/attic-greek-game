import { useEffect, useRef } from 'react'

/**
 * Page-wide keyboard shortcuts. Keys typed into a text box are left alone, and so is Enter on a
 * button or link (which already acts on it).
 */
export function useKeys(handler: (e: KeyboardEvent) => void): void {
  const latest = useRef(handler)
  useEffect(() => {
    latest.current = handler
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return
      const target = e.target as HTMLElement | null
      if (target?.closest('input, textarea, select')) return
      if (e.key === 'Enter' && target?.closest('button, a')) return
      latest.current(e)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
