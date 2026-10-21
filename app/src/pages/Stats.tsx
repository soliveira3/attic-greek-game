// Progress (SPEC §8): streak, reviews due, accuracy heat maps laid out as paradigm tables, and
// export / import of everything the app stores.

import { useState } from 'react'
import { useApp } from '../app/AppContext'
import { href } from '../app/router'
import { loadAttempts } from '../lib/attempts'
import { CLASS_FAMILIES, classLabel, featureKey } from '../lib/features'
import { exportProgress, importProgress } from '../lib/progress'
import { LESSONS, lessonState, loadPath, xpHistory } from '../lib/path'
import { loadSettings } from '../lib/settings'
import { loadSrs, localDay } from '../lib/srs'
import { accuracyByFeature, dueToday, heatLayout, streak } from '../lib/stats'

const WEEKDAY = new Intl.DateTimeFormat(undefined, { weekday: 'short' })

/** XP of the last seven days as bars, with the daily goal as a dashed line. */
function XpChart({ days, goal }: { days: { day: Date; xp: number }[]; goal: number }) {
  const top = Math.max(goal, ...days.map((d) => d.xp)) * 1.15
  return (
    <figure className="xp-chart">
      <figcaption>
        <h2>XP, last 7 days</h2>
        <span className="muted">Dashed line: your daily goal of {goal} XP</span>
      </figcaption>
      <div className="xp-plot">
        <span className="goal-line" style={{ bottom: `${(100 * goal) / top}%` }} aria-hidden="true" />
        <ol aria-label="XP, last 7 days">
          {days.map((d, i) => {
            const today = i === days.length - 1
            const name = today ? 'Today' : WEEKDAY.format(d.day)
            return (
              <li key={i} className={today ? 'today' : undefined}>
                <span className="bar-wrap">
                  <span className="bar-value" aria-hidden="true">
                    {d.xp}
                  </span>
                  <span className="bar" style={{ height: `${(100 * d.xp) / top}%` }} title={`${name}: ${d.xp} XP`} />
                </span>
                <span className="bar-day">
                  <span aria-hidden="true">{name}</span>
                  <span className="sr-only">
                    {name}: {d.xp} XP
                  </span>
                </span>
              </li>
            )
          })}
        </ol>
      </div>
    </figure>
  )
}

function level(right: number, total: number): number {
  const p = right / total
  return p >= 0.9 ? 4 : p >= 0.75 ? 3 : p >= 0.5 ? 2 : 1
}

export function Stats() {
  const { data, settings, setSettings, store } = useApp()
  const [, setVersion] = useState(0)
  const [pending, setPending] = useState<{ name: string; text: string } | null>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [now] = useState(() => new Date())

  const attempts = loadAttempts(store)
  const path = loadPath(store)
  const lessonsDone = LESSONS.filter((l) => lessonState(path, l.id) === 'done').length
  const accuracy = accuracyByFeature(attempts)
  const right = attempts.filter((a) => a.correct).length
  const played = Object.values(CLASS_FAMILIES)
    .flat()
    .filter((cls) => [...accuracy.keys()].some((k) => k.startsWith(`${cls}:`)))

  function download() {
    const blob = new Blob([JSON.stringify(exportProgress(store, new Date()), null, 1)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `attic-greek-progress-${localDay(new Date())}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function replace() {
    if (!pending) return
    const result = importProgress(store, pending.text)
    setPending(null)
    if (result.ok) {
      setSettings(loadSettings(store))
      setMessage({ ok: true, text: `Imported ${result.answers} answers.` })
    } else setMessage({ ok: false, text: result.reason })
    setVersion((v) => v + 1)
  }

  return (
    <div className="page stats">
      <h1 tabIndex={-1}>Progress</h1>
      {!store.persistent && (
        <p className="warning">
          This browser is not saving your progress: it lasts until the tab is closed. Export it below to keep it.
        </p>
      )}
      <div className="stat-row">
        <div className="stat">
          <span className="stat-label">Lessons done</span>
          <strong>
            {lessonsDone} of {LESSONS.length}
          </strong>
        </div>
        <div className="stat">
          <span className="stat-label">Day streak</span>
          <strong>{streak(attempts, now)}</strong>
        </div>
        <div className="stat">
          <span className="stat-label">Due today</span>
          <strong>{dueToday(loadSrs(store), now)}</strong>
        </div>
        <div className="stat">
          <span className="stat-label">Answers</span>
          <strong>{attempts.length}</strong>
        </div>
        <div className="stat">
          <span className="stat-label">Right</span>
          <strong>{attempts.length ? `${Math.round((100 * right) / attempts.length)}%` : '—'}</strong>
        </div>
      </div>

      <XpChart days={xpHistory(attempts, path, now)} goal={settings.dailyGoal} />

      <h2>Accuracy by form</h2>
      {played.length ? (
        <p className="muted">Each cell shows how often you got that form right, in every word of the class.</p>
      ) : (
        <p>
          No answers yet. <a href={href('review')}>Start a review</a> or try <a href={href('make')}>Make it</a>.
        </p>
      )}
      {played.map((cls) => (
        <section key={cls} className="heat" tabIndex={0} aria-label={`Accuracy: ${classLabel(cls)}`}>
          {heatLayout(cls, data, settings.scope.dual).sections.map((section, si) => (
            <table key={si} className="paradigm heat-map">
              <caption>
                {classLabel(cls)}
                {section.title ? ` — ${section.title}` : ''}
              </caption>
              <thead>
                <tr>
                  <td />
                  {section.columns.map((c) => (
                    <th key={c} scope="col">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {section.rows.map((row) => (
                  <tr key={row.label}>
                    <th scope="row">{row.label}</th>
                    {row.keys.map((key, ki) => {
                      const s = key ? accuracy.get(featureKey(cls, key)) : undefined
                      if (!s) return <td key={ki} className="heat-none" aria-label={key ? 'no answers' : 'not drilled'} />
                      return (
                        <td key={ki} className={`heat-${level(s.right, s.total)}`}>
                          <span className="pct">{Math.round((100 * s.right) / s.total)}%</span>{' '}
                          <span className="n">
                            {s.right}/{s.total}
                          </span>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
        </section>
      ))}

      <h2>Your progress file</h2>
      <p className="muted">
        Progress stays in this browser. Export it to keep a copy or move it to another device; importing replaces what
        is here.
      </p>
      <p className="actions-row">
        <button type="button" onClick={download}>
          Export progress
        </button>
        <label className="file">
          Import progress
          <input
            type="file"
            accept="application/json,.json"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (file) setPending({ name: file.name, text: await file.text() })
            }}
          />
        </label>
      </p>
      {pending && (
        <div className="warning" role="group" aria-label="Confirm import">
          <p>
            Importing {pending.name} replaces the progress in this browser ({attempts.length} answers).
          </p>
          <button type="button" className="primary" onClick={replace}>
            Replace
          </button>{' '}
          <button type="button" onClick={() => setPending(null)}>
            Cancel
          </button>
        </div>
      )}
      {message && <p role={message.ok ? 'status' : 'alert'}>{message.text}</p>}
    </div>
  )
}
