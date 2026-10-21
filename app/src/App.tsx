import { useEffect, useRef } from 'react'
import { AppProvider } from './app/AppContext'
import { type Page, href, useRoute } from './app/router'
import { Icon, type IconName } from './components/Icon'
import { Owl } from './components/Owl'
import { DailyGoal, StatChips, useToday } from './components/Today'
import { TypingProvider } from './components/typing'
import type { Paradigms } from './lib/data'
import type { Store } from './lib/storage'
import { EndingsSprint } from './pages/EndingsSprint'
import { FillTable } from './pages/FillTable'
import { Home } from './pages/Home'
import { Lesson } from './pages/Lesson'
import { MakeIt } from './pages/MakeIt'
import { NotFound } from './pages/NotFound'
import { NotesPage } from './pages/NotesPage'
import { ParseIt } from './pages/ParseIt'
import { Placement } from './pages/Placement'
import { Practice } from './pages/Practice'
import { Review } from './pages/Review'
import { SettingsPage } from './pages/SettingsPage'
import { Stats } from './pages/Stats'

const NAV: { page: Page; name: string; icon: IconName }[] = [
  { page: 'home', name: 'Learn', icon: 'path' },
  { page: 'review', name: 'Review', icon: 'review' },
  { page: 'practice', name: 'Practice', icon: 'practice' },
  { page: 'stats', name: 'Progress', icon: 'progress' },
  { page: 'notes', name: 'Notes', icon: 'notes' },
  { page: 'settings', name: 'Settings', icon: 'settings' },
]
const PRACTICE_PAGES: string[] = ['practice', 'parse', 'fill', 'make', 'sprint']
// pages with the right-hand column of today's numbers (on wide screens)
const RAIL_PAGES: string[] = ['home', 'practice', 'stats']

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
      page = <Home unit={route.topic} />
      break
    case 'review':
      page = <Review />
      break
    case 'practice':
      page = <Practice />
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
    case 'stats':
      page = <Stats />
      break
    case 'settings':
      page = <SettingsPage />
      break
    case 'notes':
      page = <NotesPage topic={route.topic} />
      break
    case 'lesson':
      page = <Lesson id={route.topic ?? ''} />
      break
    case 'placement':
      page = <Placement />
      break
    default:
      page = <NotFound />
  }

  // a lesson takes the whole screen, like a game level
  if (route.page === 'lesson' || route.page === 'placement') {
    return (
      <div className="app focus-mode">
        <main ref={main}>{page}</main>
      </div>
    )
  }

  const current = (p: Page) => p === route.page || (p === 'practice' && PRACTICE_PAGES.includes(route.page))
  const rail = RAIL_PAGES.includes(route.page)
  return (
    <div className={`app${rail ? ' has-rail' : ''}`}>
      <a className="skip-link" href="#main" onClick={(e) => {
        e.preventDefault()
        main.current?.querySelector<HTMLElement>('h1')?.focus()
      }}>
        Skip to the content
      </a>
      <aside className="sidebar">
        <a className="brand" href={href('home')}>
          <Owl size={40} />
          <span>Attic Greek</span>
        </a>
        <nav aria-label="Main">
          {NAV.map((n) => (
            <a key={n.page} href={href(n.page)} aria-current={current(n.page) ? 'page' : undefined}>
              <Icon name={n.icon} size={26} />
              <span>{n.name}</span>
            </a>
          ))}
        </nav>
      </aside>
      <div className="column">
        <TopBar />
        <main ref={main} id="main">
          {page}
        </main>
        <footer className="site">
          <p>
            Forms from <a href="https://en.wiktionary.org/">Wiktionary</a> (CC BY-SA 4.0), extracted by{' '}
            <a href="https://kaikki.org/">kaikki.org</a>; word list and glosses from the{' '}
            <a href="https://dcc.dickinson.edu/greek-core-list">DCC Greek Core Vocabulary</a> (CC BY-SA). Grammar
            references: Smyth, <cite>Greek Grammar</cite> (1920). Progress stays in this browser.
          </p>
        </footer>
      </div>
      {rail && <Rail />}
    </div>
  )
}

/** Today's numbers above the page on narrow screens. */
function TopBar() {
  const today = useToday()
  return (
    <header className="topbar">
      <a className="brand" href={href('home')}>
        <Owl size={34} />
        <span className="sr-only">Attic Greek, home</span>
      </a>
      <StatChips stats={today} />
    </header>
  )
}

/** Today's numbers beside the page on wide screens. */
function Rail() {
  const today = useToday()
  return (
    <aside className="rail" aria-label="Today">
      <StatChips stats={today} />
      <DailyGoal stats={today} />
      <section className="rail-card tip-card" aria-labelledby="tip-title">
        <h2 id="tip-title">Typing Greek</h2>
        <p>
          Type beta code and it turns into Greek: marks go after the letter, <kbd>/</kbd> acute, <kbd>=</kbd> circumflex,{' '}
          <kbd>(</kbd> rough breathing, <kbd>|</kbd> iota subscript.
        </p>
      </section>
    </aside>
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
