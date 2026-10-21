// Practice: the free modes, outside the path, drawing on the words chosen in Settings.
import { useApp } from '../app/AppContext'
import { MODES } from '../app/modes'
import { href } from '../app/router'
import { Icon, type IconName } from '../components/Icon'
import { TypingHint } from '../components/TypingHint'
import { lemmasInScope } from '../lib/prompts'

const STRICTNESS_NAMES = { strict: 'strict', 'ignore-accents': 'ignore accents', lenient: 'lenient' } as const
const LOOK: Record<(typeof MODES)[number]['page'], { icon: IconName; tone: string }> = {
  parse: { icon: 'eye', tone: 'sea' },
  fill: { icon: 'grid', tone: 'teal' },
  make: { icon: 'pen', tone: 'olive' },
  sprint: { icon: 'timer', tone: 'amber' },
}

export function Practice() {
  const { data, settings } = useApp()
  const words = lemmasInScope(data, settings).length
  return (
    <div className="page practice">
      <h1 tabIndex={-1}>Practice</h1>
      <p className="lead">Drill freely, outside the path. Every answer still counts towards your reviews and your daily goal.</p>
      <ul className="mode-tiles">
        {MODES.map((m) => (
          <li key={m.page}>
            <a className={`mode-tile tone-${LOOK[m.page].tone}`} href={href(m.page)}>
              <span className="mode-icon">
                <Icon name={LOOK[m.page].icon} size={30} />
              </span>
              <span className="mode-name">{m.name}</span>
              <span className="mode-text">{m.text}</span>
            </a>
          </li>
        ))}
      </ul>
      <p className="scope-line">
        {words} words in scope, answer checking: {STRICTNESS_NAMES[settings.strictness]}.{' '}
        <a href={href('settings')}>Change the settings</a>
      </p>
      <TypingHint />
    </div>
  )
}
