import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { href, parseRoute, useRoute } from './router'

describe('parseRoute', () => {
  it('reads the page from the hash', () => {
    expect(parseRoute('')).toEqual({ page: 'home' })
    expect(parseRoute('#/')).toEqual({ page: 'home' })
    expect(parseRoute('#/parse')).toEqual({ page: 'parse' })
    expect(parseRoute('#/sprint/')).toEqual({ page: 'sprint' })
    expect(parseRoute('#/settings')).toEqual({ page: 'settings' })
  })
  it('reads a notes topic', () => {
    expect(parseRoute('#/notes')).toEqual({ page: 'notes' })
    expect(parseRoute('#/notes/augment')).toEqual({ page: 'notes', topic: 'augment' })
    expect(parseRoute(href('notes', 'decl3 s'))).toEqual({ page: 'notes', topic: 'decl3 s' })
  })
  it('reads the practice page and a lesson id', () => {
    expect(parseRoute('#/practice')).toEqual({ page: 'practice' })
    expect(parseRoute(href('lesson', 'decl2.3'))).toEqual({ page: 'lesson', topic: 'decl2.3' })
    expect(parseRoute('#/lesson')).toEqual({ page: 'not-found' })
    expect(parseRoute('#/lesson/a/b')).toEqual({ page: 'not-found' })
  })
  it('reads a unit of the path, and the placement check', () => {
    expect(parseRoute(href('home', 'decl2'))).toEqual({ page: 'home', topic: 'decl2' })
    expect(href('home', 'decl2')).toBe('#/unit/decl2')
    expect(parseRoute('#/placement')).toEqual({ page: 'placement' })
  })
  it('sends anything else to "not found"', () => {
    expect(parseRoute('#/nope')).toEqual({ page: 'not-found' })
    expect(parseRoute('#/parse/extra')).toEqual({ page: 'not-found' })
    expect(parseRoute('#/home')).toEqual({ page: 'not-found' })
  })
})

describe('href', () => {
  it('builds hash links', () => {
    expect(href('home')).toBe('#/')
    expect(href('make')).toBe('#/make')
    expect(href('notes', 'augment')).toBe('#/notes/augment')
  })
})

describe('useRoute', () => {
  it('follows hash changes', () => {
    window.location.hash = '#/fill'
    const { result } = renderHook(() => useRoute())
    expect(result.current).toEqual({ page: 'fill' })
    act(() => {
      window.location.hash = '#/notes/augment'
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    })
    expect(result.current).toEqual({ page: 'notes', topic: 'augment' })
    window.location.hash = ''
  })
})
