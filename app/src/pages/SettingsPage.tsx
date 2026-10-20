// Settings (SPEC §10): answer checking, what to practise, display. Changes are saved at once.

import { useApp } from '../app/AppContext'
import { STRICTNESS, type Strictness } from '../lib/check'
import {
  CLASS_FAMILIES,
  type LemmaClass,
  POS,
  type Pos,
  TENSES,
  TENSE_LABELS,
  VOICE_GROUPS,
  VOICE_GROUP_LABELS,
  classLabel,
} from '../lib/features'
import { lemmasInScope } from '../lib/prompts'
import type { Settings } from '../lib/settings'

const STRICTNESS_LABELS: Record<Strictness, [string, string]> = {
  strict: ['Strict', 'letters, breathings, iota subscript and accents must all be right'],
  'ignore-accents': ['Ignore accents', 'letters, breathings and iota subscript must be right (default)'],
  lenient: ['Lenient', 'only the letters must be right'],
}
const POS_LABELS: Record<Pos, string> = { noun: 'Nouns', adj: 'Adjectives', article: 'The article', verb: 'Verbs' }
const ALL_CLASSES = Object.values(CLASS_FAMILIES).flat()

function toggle<T>(list: T[], value: T, on: boolean, order: readonly T[]): T[] {
  const next = on ? [...list, value] : list.filter((v) => v !== value)
  return order.filter((v) => next.includes(v))
}

export function SettingsPage() {
  const { data, settings, setSettings } = useApp()
  const { scope } = settings
  const setScope = (patch: Partial<Settings['scope']>) => setSettings({ ...settings, scope: { ...scope, ...patch } })
  const classOn = (c: LemmaClass) => !scope.classes.length || scope.classes.includes(c)
  const setClass = (c: LemmaClass, on: boolean) => {
    const next = toggle(ALL_CLASSES.filter(classOn), c, on, ALL_CLASSES)
    setScope({ classes: next.length === ALL_CLASSES.length ? [] : next })
  }
  const words = lemmasInScope(data, settings).length

  return (
    <div className="page settings">
      <h1 tabIndex={-1}>Settings</h1>
      <p role="status" className={words ? 'muted' : 'warning'}>
        {words ? `${words} words in scope.` : 'Nothing to practise with these settings: choose at least one part of speech, class, tense and voice.'}
      </p>

      <fieldset>
        <legend>Answer checking</legend>
        {STRICTNESS.map((s) => (
          <label key={s} className="choice">
            <input
              type="radio"
              name="strictness"
              checked={settings.strictness === s}
              onChange={() => setSettings({ ...settings, strictness: s })}
            />
            <span>
              <strong>{STRICTNESS_LABELS[s][0]}</strong> — {STRICTNESS_LABELS[s][1]}
            </span>
          </label>
        ))}
        <p className="muted">Vowel-length marks are never required. Accents never count in the endings sprint.</p>
      </fieldset>

      <fieldset>
        <legend>Parts of speech</legend>
        {POS.map((p) => (
          <label key={p} className="choice">
            <input
              type="checkbox"
              checked={scope.pos.includes(p)}
              onChange={(e) => setScope({ pos: toggle(scope.pos, p, e.target.checked, POS) })}
            />
            {POS_LABELS[p]}
          </label>
        ))}
      </fieldset>

      <fieldset>
        <legend>Classes</legend>
        <button type="button" onClick={() => setScope({ classes: [] })}>
          All classes
        </button>
        {Object.entries(CLASS_FAMILIES).map(([family, classes]) => (
          <fieldset key={family} className="family">
            <legend>{family}</legend>
            {classes.map((c) => (
              <label key={c} className="choice">
                <input type="checkbox" checked={classOn(c)} onChange={(e) => setClass(c, e.target.checked)} />
                {classLabel(c)}
              </label>
            ))}
            <button type="button" className="small" onClick={() => setScope({ classes: [...classes] })}>
              Only these
            </button>
          </fieldset>
        ))}
      </fieldset>

      <fieldset>
        <legend>Verbs</legend>
        <fieldset className="family">
          <legend>Tenses</legend>
          {TENSES.map((t) => (
            <label key={t} className="choice">
              <input
                type="checkbox"
                checked={scope.tenses.includes(t)}
                onChange={(e) => setScope({ tenses: toggle(scope.tenses, t, e.target.checked, TENSES) })}
              />
              {TENSE_LABELS[t][0]}
            </label>
          ))}
        </fieldset>
        <fieldset className="family">
          <legend>Voices</legend>
          {VOICE_GROUPS.map((v) => (
            <label key={v} className="choice">
              <input
                type="checkbox"
                checked={scope.voices.includes(v)}
                onChange={(e) => setScope({ voices: toggle(scope.voices, v, e.target.checked, VOICE_GROUPS) })}
              />
              {VOICE_GROUP_LABELS[v][0]}
            </label>
          ))}
          <p className="muted">Middle/passive: the forms the two voices share (present, imperfect, perfect).</p>
        </fieldset>
      </fieldset>

      <fieldset>
        <legend>Dual</legend>
        <label className="choice">
          <input type="checkbox" checked={scope.dual} onChange={(e) => setScope({ dual: e.target.checked })} />
          Include the dual
        </label>
      </fieldset>

      <fieldset>
        <legend>Display</legend>
        <label className="choice">
          <input
            type="checkbox"
            checked={settings.lengthMarks}
            onChange={(e) => setSettings({ ...settings, lengthMarks: e.target.checked })}
          />
          Show vowel-length marks (macron, breve) in forms
        </label>
      </fieldset>
    </div>
  )
}
