// A small hash router: works on GitHub Pages without server rewrites (SPEC §10).

import { useSyncExternalStore } from 'react'

export const PAGES = ['home', 'review', 'practice', 'parse', 'fill', 'make', 'sprint', 'stats', 'settings', 'notes', 'lesson', 'placement'] as const
export type Page = (typeof PAGES)[number]

export interface Route {
  page: Page | 'not-found'
  /** Notes: the note shown; lesson: the lesson played; home: the unit scrolled to. */
  topic?: string
}

const isPage = (s: string): s is Page => (PAGES as readonly string[]).includes(s)

export function parseRoute(hash: string): Route {
  try {
    return routeOf(hash)
  } catch {
    // decodeURIComponent throws on broken percent-encoding (a mangled link)
    return { page: 'not-found' }
  }
}

function routeOf(hash: string): Route {
  const [first, ...rest] = hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  if (!first) return { page: 'home' }
  if (first === 'notes') return rest.length ? { page: 'notes', topic: decodeURIComponent(rest.join('/')) } : { page: 'notes' }
  if (first === 'unit') return rest.length === 1 ? { page: 'home', topic: decodeURIComponent(rest[0]) } : { page: 'not-found' }
  if (first === 'lesson') return rest.length === 1 ? { page: 'lesson', topic: decodeURIComponent(rest[0]) } : { page: 'not-found' }
  if (isPage(first) && first !== 'home' && first !== 'lesson' && !rest.length) return { page: first }
  return { page: 'not-found' }
}

export function href(page: Page, topic?: string): string {
  if (page === 'home') return topic ? `#/unit/${encodeURIComponent(topic)}` : '#/'
  return `#/${page}${topic ? `/${encodeURIComponent(topic)}` : ''}`
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

/** The current route; re-renders on every hash change. */
export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash)
  return parseRoute(hash)
}
