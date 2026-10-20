// A small hash router: works on GitHub Pages without server rewrites (SPEC §10).

import { useSyncExternalStore } from 'react'

export const PAGES = ['home', 'review', 'parse', 'fill', 'make', 'sprint', 'stats', 'settings', 'notes'] as const
export type Page = (typeof PAGES)[number]

export interface Route {
  page: Page | 'not-found'
  /** Notes only: the note shown. */
  topic?: string
}

const isPage = (s: string): s is Page => (PAGES as readonly string[]).includes(s)

export function parseRoute(hash: string): Route {
  const [first, ...rest] = hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  if (!first) return { page: 'home' }
  if (first === 'notes') return rest.length ? { page: 'notes', topic: decodeURIComponent(rest.join('/')) } : { page: 'notes' }
  if (isPage(first) && first !== 'home' && !rest.length) return { page: first }
  return { page: 'not-found' }
}

export function href(page: Page, topic?: string): string {
  if (page === 'home') return '#/'
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
