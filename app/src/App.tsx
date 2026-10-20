import { useEffect, useRef } from 'react'
import { AppProvider } from './app/AppContext'
import { type Page, href, useRoute } from './app/router'
import { TypingProvider } from './components/typing'
import type { Paradigms } from './lib/data'
import type { Store } from './lib/storage'
import { EndingsSprint } from './pages/EndingsSprint'
import { FillTable } from './pages/FillTable'
import { Home, MODES } from './pages/Home'
import { MakeIt } from './pages/MakeIt'
import { NotFound } from './pages/NotFound'
import { NotesPage } from './pages/NotesPage'
import { ParseIt } from './pages/ParseIt'
import { SettingsPage } from './pages/SettingsPage'

const NAV: { page: Page; name: string }[] = [...MODES, { page: 'notes', name: 'Notes' }, { page: 'settings', name: 'Settings' }]

function Screen() {
  const route = useRoute()
  const main = useRef<HTMLElement>(null)
  const shown = useRef(`${route.page}/${route.topic ?? ''}`)
  // On a new page, focus its heading so screen readers and keyboard users start there, unless the
  // page has already focused what it is about (a mode focuses its answer box).
  useEffect(() => {
    const now = `${route.page}/${route.topic ?? ''}`
    if (shown.current === now) return
    shown.current = now
    if (!main.current?.contains(document.activeElement)) main.current?.querySelector<HTMLElement>('h1')?.focus()
  }, [route.page, route.topic])

  let page
  switch (route.page) {
    case 'home':
      page = <Home />
      break
    case 'parse':
      page = <ParseIt />
      break
    case 'fill':
      page = <FillTable />
      break
    case 'make':
      page = <MakeIt />
      break
    case 'sprint':
      page = <EndingsSprint />
      break
    case 'settings':
      page = <SettingsPage />
      break
    case 'notes':
      page = <NotesPage topic={route.topic} />
      break
    default:
      page = <NotFound />
  }

  return (
    <>
      <header className="site">
        <a className="brand" href={href('home')}>
          Attic Greek
        </a>
        <nav aria-label="Main">
          {NAV.map((n) => (
            <a key={n.page} href={href(n.page)} aria-current={route.page === n.page ? 'page' : undefined}>
              {n.name}
            </a>
          ))}
        </nav>
      </header>
      <main ref={main}>{page}</main>
    </>
  )
}

interface Props {
  store: Store
  data?: Paradigms
  load?: () => Promise<Paradigms>
}

export default function App({ store, data, load }: Props) {
  return (
    <AppProvider store={store} data={data} load={load}>
      <TypingProvider>
        <Screen />
      </TypingProvider>
    </AppProvider>
  )
}
