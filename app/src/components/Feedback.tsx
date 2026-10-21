// What the player sees after answering (SPEC §5): the verdict in plain words, the valid form with
// the differing part highlighted, any other valid forms, a link to the grammar note, and Next.

import { useApp } from '../app/AppContext'
import { href } from '../app/router'
import type { ReactNode } from 'react'
import type { CheckResult, Segment } from '../lib/check'
import { verdict } from '../lib/feedback'
import { displayForm, key } from '../lib/normalize'
import { NOTE_TITLES, type NoteTopic } from '../lib/notes'
import { Icon } from './Icon'

export function Diff({ segments }: { segments: Segment[] }) {
  const { settings } = useApp()
  return (
    <span className="form" lang="grc">
      {segments.map((s, i) => {
        const text = displayForm(s.text, { lengthMarks: settings.lengthMarks })
        return s.ok ? <span key={i}>{text}</span> : <mark key={i}>{text}</mark>
      })}
    </span>
  )
}

export function NoteLink({ topic }: { topic: NoteTopic }) {
  return (
    <a className="note-link" href={href('notes', topic)}>
      <Icon name="notes" size={18} />
      Grammar note: {NOTE_TITLES[topic]}
    </a>
  )
}

/** The verdict line of a feedback sheet, with its badge. */
export function SheetHead({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <p className="verdict">
      <span className="badge" aria-hidden="true">
        <Icon name={ok ? 'check' : 'wrong'} size={22} />
      </span>
      {children}
    </p>
  )
}

interface Props {
  result: CheckResult
  /** Every valid form of the cell. */
  forms: string[]
  topic: NoteTopic
  onNext?: () => void
}

export function Feedback({ result, forms, topic, onNext }: Props) {
  const { settings } = useApp()
  const v = verdict(result)
  const others = forms.filter((f) => key(f) !== key(result.closest))
  const show = (f: string) => displayForm(f, { lengthMarks: settings.lengthMarks })
  return (
    <section className={`feedback sheet ${v.ok ? 'ok' : 'bad'}`} aria-label="Feedback">
      <div className="sheet-inner">
        <div className="sheet-body">
          <SheetHead ok={v.ok}>
            <strong>{v.headline}</strong>
          </SheetHead>
          {v.details.length > 0 && (
            <p className="verdict-detail">
              {v.details.map((d, i) => (
                <span key={d}>
                  {i > 0 && ' '}
                  {d}
                </span>
              ))}
            </p>
          )}
          {!result.exact && (
            <dl className="comparison">
              {result.errorKind !== 'blank' && (
                <>
                  <dt>You typed:</dt>
                  <dd>
                    <Diff segments={result.diff.answer} />
                  </dd>
                </>
              )}
              <dt>Correct form:</dt>
              <dd>
                <Diff segments={result.diff.expected} />
              </dd>
            </dl>
          )}
          {others.length > 0 && (
            <p className="also">
              Also right: <span lang="grc">{others.map(show).join(', ')}</span>
            </p>
          )}
          <NoteLink topic={topic} />
        </div>
        {onNext && (
          <button type="button" className={`btn big ${v.ok ? 'primary' : 'danger'}`} onClick={onNext}>
            Continue <kbd>Enter</kbd>
          </button>
        )}
      </div>
    </section>
  )
}
