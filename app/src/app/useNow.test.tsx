import { act, renderHook, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StatChips, useToday } from '../components/Today'
import { recordAttempt } from '../lib/attempts'
import { createStore } from '../lib/storage'
import { renderWithApp } from '../test/render'
import { useNow } from './useNow'

const EVENING = new Date(2026, 9, 20, 23, 59, 0)

describe('useNow', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(EVENING)
  })
  afterEach(() => vi.useRealTimers())

  it('moves to the next day at midnight without any other change', () => {
    const { result } = renderHook(() => useNow())
    expect(result.current.getDate()).toBe(20)
    act(() => vi.advanceTimersByTime(2 * 60_000))
    expect(result.current.getDate()).toBe(21)
  })

  it('reads the clock again when the page becomes visible (timers may sleep)', () => {
    const { result } = renderHook(() => useNow())
    vi.setSystemTime(new Date(2026, 9, 22, 9, 0, 0))
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(result.current.getDate()).toBe(22)
  })

  it('keeps the day numbers current: XP today goes back to 0 after midnight', () => {
    const store = createStore(null)
    recordAttempt(store, { itemKey: 'x|y', featureKey: 'y', correct: true, errorKind: null, ts: Date.now(), mode: 'make' })
    function Chips() {
      return <StatChips stats={useToday()} />
    }
    renderWithApp(<Chips />, { store })
    expect(screen.getByTitle('XP today')).toHaveTextContent(/^1/)
    act(() => vi.advanceTimersByTime(2 * 60_000))
    expect(screen.getByTitle('XP today')).toHaveTextContent(/^0/)
  })
})
