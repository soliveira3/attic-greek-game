// Grammar notes (SPEC §9): an index, and each note with its forms and tables drawn from the data.

import { Fragment, type ReactNode, useMemo } from 'react'
import { useApp } from '../app/AppContext'
import { href } from '../app/router'
import type { Paradigms } from '../lib/data'
import { goldenModels, splitForm, sprintSets } from '../lib/endings'
import { blockLabel, cellLabel } from '../lib/features'
import { type Block, type Inline, PRINCIPAL_PARTS, loadNotes } from '../lib/grammar'
import { displayForm } from '../lib/normalize'
import { NOTE_TITLES, NOTE_TOPICS, isNoteTopic } from '../lib/notes'
import { tableLayout } from '../lib/tables'

const GROUPS: [string, string[]][] = [
  ['Nouns, adjectives and the article', NOTE_TOPICS.filter((t) => t === 'article' || t.startsWith('decl') || t.startsWith('adj'))],
  ['Verbs', NOTE_TOPICS.filter((t) => !(t === 'article' || t.startsWith('decl') || t.startsWith('adj') || t === 'accent'))],
  ['Accents and breathings', ['accent']],
]
const PART_LABELS = ['present', 'future', 'aorist', 'perfect active', 'perfect middle', 'aorist passive']

function useShow() {
  const { settings } = useApp()
  return (form: string) => displayForm(form, { lengthMarks: settings.lengthMarks })
}

function InlineView({ items, data }: { items: Inline[]; data: Paradigms }) {
  const show = useShow()
  return (
    <>
      {items.map((i, n) => {
        if (i.kind === 'text') return <Fragment key={n}>{i.text}</Fragment>
        if (i.kind === 'strong') return <strong key={n}>{i.text}</strong>
        if (i.kind === 'em') return <em key={n}>{i.text}</em>
        if (i.kind === 'link') return <a key={n} href={href('notes', i.topic)}>{i.text}</a>
        const lemma = data.lemma(i.ref)!
        if (i.kind === 'word') return <span key={n} lang="grc" className="greek">{show(lemma.lemma)}</span>
        return (
          <span key={n} lang="grc" className="greek">
            {i.cells.map((c) => data.forms(lemma, c).map(show).join(' or ')).join(', ')}
          </span>
        )
      })}
    </>
  )
}

function ParadigmTable({ ref, block, data, hint }: { ref: string; block: string | null; data: Paradigms; hint: boolean }) {
  const { settings } = useApp()
  const show = useShow()
  const lemma = data.lemma(ref)!
  const sets = useMemo(
    () => sprintSets(goldenModels(), Object.fromEntries(data.lemmasWhere({ pos: ['verb'] }).map((l) => [l.lemma, 'aoristType' in l ? l.aoristType : []]))),
    [data],
  )
  const set = sets.find((s) => s.lemma === lemma.lemma && s.block === block)
  const cells = data.cellsInScope(lemma, { dual: settings.scope.dual }).filter((c) => !block || c.key.startsWith(`${block}.`))
  const layout = tableLayout(lemma, cells)
  const form = (key: string): ReactNode =>
    data.forms(lemma, key).map((f, i) => {
      const [stem, ending] = set && key in set.cells ? splitForm(f, set.stemLength) : [f, '']
      return (
        <Fragment key={i}>
          {i > 0 && ', '}
          {show(stem)}
          {ending && <span className="ending">{show(ending)}</span>}
        </Fragment>
      )
    })
  return (
    // focusable, so the table can be scrolled with the keyboard on a narrow screen
    <div className="note-table" tabIndex={0} role="region" aria-label={`Table: ${lemma.lemma}${block ? `, ${blockLabel(block)}` : ''}`}>
      {layout.sections.map((section, si) => (
        <table key={si} className="paradigm">
          <caption>
            <span lang="grc">{show(lemma.lemma)}</span> — {block ? blockLabel(block) : lemma.gloss.split(/[;,(]/)[0].trim()}
            {section.title ? `, ${section.title}` : ''}
          </caption>
          <thead>
            <tr>
              <td />
              {section.columns.map((c) => (
                <th key={c} scope="col">
                  {c === 'form' ? '' : c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {section.rows.map((row) => (
              <tr key={row.label}>
                <th scope="row">{row.label}</th>
                {row.keys.map((key, i) => (
                  <td key={i} lang="grc" className="given">
                    {key ? form(key) : ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ))}
      {set && hint && <p className="muted small">The part in colour is the ending, as drilled in the endings sprint.</p>}
    </div>
  )
}

function PartsTable({ refs, data }: { refs: string[]; data: Paradigms }) {
  const show = useShow()
  return (
    <div className="note-table" tabIndex={0} role="region" aria-label="Table: principal parts">
      <table className="paradigm parts">
        <caption>Principal parts</caption>
        <thead>
          <tr>
            {PART_LABELS.map((l) => (
              <th key={l} scope="col">
                {l}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {refs.map((ref) => {
            const lemma = data.lemma(ref)!
            return (
              <tr key={ref}>
                {PRINCIPAL_PARTS.map((keys, i) => {
                  const key = keys.find((k) => data.forms(lemma, k).length)
                  return (
                    <td key={i} lang="grc" className="given" title={key ? cellLabel(key) : undefined}>
                      {key ? data.forms(lemma, key).map(show).join(', ') : '—'}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function BlockView({ block, data, first }: { block: Block; data: Paradigms; first: boolean }) {
  switch (block.kind) {
    case 'heading':
      return <h2>{block.text}</h2>
    case 'paragraph':
      return (
        <p>
          <InlineView items={block.content} data={data} />
        </p>
      )
    case 'list':
      return (
        <ul>
          {block.items.map((item, i) => (
            <li key={i}>
              <InlineView items={item} data={data} />
            </li>
          ))}
        </ul>
      )
    case 'table':
      return <ParadigmTable ref={block.ref} block={block.block} data={data} hint={first} />
    case 'parts':
      return <PartsTable refs={block.refs} data={data} />
  }
}

export function NotesPage({ topic }: { topic?: string }) {
  const { data } = useApp()
  const notes = useMemo(() => loadNotes(), [])
  const note = topic ? notes.get(topic) : undefined

  if (!topic) {
    return (
      <div className="page notes">
        <h1 tabIndex={-1}>Grammar notes</h1>
        <p>Short notes on the forms drilled here, with references to Smyth’s Greek Grammar (1920).</p>
        {GROUPS.map(([title, topics]) => (
          <section key={title}>
            <h2>{title}</h2>
            <ul>
              {topics.filter(isNoteTopic).map((t) => (
                <li key={t}>
                  <a href={href('notes', t)}>{NOTE_TITLES[t]}</a>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    )
  }
  if (!note) {
    return (
      <div className="page notes">
        <h1 tabIndex={-1}>Grammar notes</h1>
        <p>There is no note on that.</p>
        <p>
          <a href={href('notes')}>All notes</a>
        </p>
      </div>
    )
  }
  return (
    <article className="page notes note">
      <p className="crumbs">
        <a href={href('notes')}>All notes</a>
      </p>
      <h1 tabIndex={-1}>{note.title}</h1>
      {note.blocks.map((b, i) => (
        <BlockView key={i} block={b} data={data} first={i === note.blocks.findIndex((x) => x.kind === 'table')} />
      ))}
    </article>
  )
}
