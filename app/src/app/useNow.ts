import { useEffect, useState } from 'react'

/**
 * The current time for day-based numbers (streak, XP today, reviews due, weak spots). Read once
 * on mount, again just after each local midnight, and whenever the page becomes visible (timers
 * can sleep while a laptop does), so the numbers stay right in a tab left open overnight.
 */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
    const id = setTimeout(() => setNow(new Date()), midnight.getTime() - now.getTime() + 1000)
    return () => clearTimeout(id)
  }, [now])
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') setNow(new Date())
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])
  return now
}
