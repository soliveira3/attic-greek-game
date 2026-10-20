import { describe, expect, it, vi } from 'vitest'
import { browserStorage, createStore } from './storage'

const throwing = {
  getItem: () => {
    throw new Error('denied')
  },
  setItem: () => {
    throw new Error('denied')
  },
  removeItem: () => {
    throw new Error('denied')
  },
} as unknown as Storage

describe('createStore', () => {
  it('reads and writes JSON through the backing storage', () => {
    const backing = new Map<string, string>()
    const fake = {
      getItem: (k: string) => backing.get(k) ?? null,
      setItem: (k: string, v: string) => void backing.set(k, v),
      removeItem: (k: string) => void backing.delete(k),
    } as unknown as Storage
    const store = createStore(fake)
    store.write('a', { x: 1 })
    expect(store.read('a', null)).toEqual({ x: 1 })
    expect(createStore(fake).read('a', null)).toEqual({ x: 1 }) // persisted
    store.remove('a')
    expect(store.read('a', 'fallback')).toBe('fallback')
    expect(store.persistent).toBe(true)
  })
  it('keeps working in memory when storage throws', () => {
    const store = createStore(throwing)
    store.write('a', [1, 2])
    expect(store.read('a', [])).toEqual([1, 2])
    expect(store.persistent).toBe(false)
  })
  it('works without any storage, and survives corrupt JSON', () => {
    const store = createStore(null)
    store.write('k', 1)
    expect(store.read('k', 0)).toBe(1)
    const corrupt = { getItem: () => '{not json', setItem: () => {}, removeItem: () => {} } as unknown as Storage
    expect(createStore(corrupt).read('k', 'fallback')).toBe('fallback')
  })
})

describe('browserStorage', () => {
  it('is localStorage where it can be touched', () => {
    expect(browserStorage()).toBe(window.localStorage)
  })
  it('is null where touching it throws', () => {
    const spy = vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    expect(browserStorage()).toBeNull()
    spy.mockRestore()
  })
})
