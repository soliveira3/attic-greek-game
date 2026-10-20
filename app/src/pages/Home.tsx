import { useApp } from '../app/AppContext'
import { href } from '../app/router'
import { TypingHint } from '../components/TypingHint'
import { lemmasInScope } from '../lib/prompts'

const STRICTNESS_NAMES = { strict: 'strict', 'ignore-accents': 'ignore accents', lenient: 'lenient' } as const

export const MODES = [
  { page: 'parse', name: 'Parse it', text: 'Identify a form: its case, number and gender, or its tense, voice, mood, person and number.' },
  { page: 'fill', name: 'Fill the table', text: 'Complete a paradigm, or one tense and voice of a verb, with some cells left blank.' },
  { page: 'make', name: 'Make it', text: 'Type the form of a word that the features ask for.' },
  { page: 'sprint', name: 'Endings sprint', text: 'Sixty seconds of endings for one declension class or one tense and voice.' },
] as const

export function Home() {
  const { data, settings } = useApp()
  const words = lemmasInScope(data, settings).length
  return (
    <div className="page home">
      <h1 tabIndex={-1}>Attic Greek Morphology</h1>
      <p className="lead">
        Drill the forms of Attic Greek nouns, adjectives and verbs until they are automatic. Every form comes from checked
        source data.
      </p>
      <ul className="modes">
        {MODES.map((m) => (
          <li key={m.page}>
            <a href={href(m.page)}>{m.name}</a>
            <p>{m.text}</p>
          </li>
        ))}
      </ul>
      <p className="muted">
        {words} words in scope · answer checking: {STRICTNESS_NAMES[settings.strictness]} ·{' '}
        <a href={href('settings')}>change the settings</a>
      </p>
      <TypingHint />
    </div>
  )
}
