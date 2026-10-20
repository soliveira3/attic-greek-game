// Grammar notes (SPEC §9): data/grammar/<topic>.md, original prose citing Smyth. Greek forms are
// never typed in a note: placeholders pull them from the paradigm data when the note is shown.
//
//   # Title                              first line; must match NOTE_TITLES
//   ## Heading
//   - list item
//   {{table noun:λόγος}}                 a nominal paradigm (singular and plural)
//   {{table verb:λύω aor.mid}}           one tense-voice block of a verb
//   {{parts verb:λύω verb:λείπω}}        principal parts, one verb per row
//   {{form verb:λύω impf.act.ind.1.sg}}  inline: the form(s) of one or more cells (a form shared by
//                                        several of the cells is shown once)
//   {{word noun:λόγος}}                  inline: the headword
//   **bold**, *italic*, [text](topic)    a link to another note

import type { Paradigms } from './data'
import { NOTE_TITLES, type NoteTopic, isNoteTopic } from './notes'
import { stripAll } from './normalize'

export type Inline =
  | { kind: 'text'; text: string }
  | { kind: 'strong'; text: string }
  | { kind: 'em'; text: string }
  | { kind: 'form'; ref: string; cells: string[] }
  | { kind: 'word'; ref: string }
  | { kind: 'link'; text: string; topic: string }

export type Block =
  | { kind: 'heading'; text: string }
  | { kind: 'paragraph'; content: Inline[] }
  | { kind: 'list'; items: Inline[][] }
  | { kind: 'table'; ref: string; block: string | null }
  | { kind: 'parts'; refs: string[] }

export interface Note {
  topic: string
  title: string
  blocks: Block[]
}

const INLINE = /\{\{(form|word) ([^}]+)\}\}|\*\*(.+?)\*\*|\*(.+?)\*|\[([^\]]+)\]\(([a-z0-9-]+)\)/gu

export function parseInline(text: string): Inline[] {
  const out: Inline[] = []
  let at = 0
  for (const m of text.matchAll(INLINE)) {
    if (m.index > at) out.push({ kind: 'text', text: text.slice(at, m.index) })
    if (m[1] === 'form') {
      const [ref, ...cells] = m[2].trim().split(/\s+/)
      out.push({ kind: 'form', ref, cells })
    } else if (m[1] === 'word') out.push({ kind: 'word', ref: m[2].trim() })
    else if (m[3] !== undefined) out.push({ kind: 'strong', text: m[3] })
    else if (m[4] !== undefined) out.push({ kind: 'em', text: m[4] })
    else out.push({ kind: 'link', text: m[5], topic: m[6] })
    at = m.index + m[0].length
  }
  if (at < text.length) out.push({ kind: 'text', text: text.slice(at) })
  return out
}

const BLOCK_PLACEHOLDER = /^\{\{(table|parts) ([^}]+)\}\}$/u

export function parseNote(topic: string, source: string): Note {
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  const title = lines[0]?.startsWith('# ') ? lines[0].slice(2).trim() : ''
  const blocks: Block[] = []
  let paragraph: string[] = []
  let list: string[] = []
  const flush = () => {
    if (paragraph.length) blocks.push({ kind: 'paragraph', content: parseInline(paragraph.join(' ')) })
    if (list.length) blocks.push({ kind: 'list', items: list.map(parseInline) })
    paragraph = []
    list = []
  }
  for (const raw of lines.slice(title ? 1 : 0)) {
    const line = raw.trim()
    const placeholder = line.match(BLOCK_PLACEHOLDER)
    if (!line) flush()
    else if (line.startsWith('## ')) {
      flush()
      blocks.push({ kind: 'heading', text: line.slice(3).trim() })
    } else if (placeholder) {
      flush()
      const args = placeholder[2].trim().split(/\s+/)
      blocks.push(placeholder[1] === 'table' ? { kind: 'table', ref: args[0], block: args[1] ?? null } : { kind: 'parts', refs: args })
    } else if (line.startsWith('- ')) {
      if (paragraph.length) flush()
      list.push(line.slice(2))
    } else {
      if (list.length) flush()
      paragraph.push(line)
    }
  }
  flush()
  return { topic, title, blocks }
}

/** The notes in data/grammar/, by topic. */
export function loadNotes(): Map<string, Note> {
  const files = import.meta.glob<string>('../../../data/grammar/*.md', { eager: true, query: '?raw', import: 'default' })
  return new Map(
    Object.entries(files).map(([path, source]) => {
      const topic = path.split('/').pop()!.replace(/\.md$/, '')
      return [topic, parseNote(topic, source)]
    }),
  )
}

function inlines(note: Note): Inline[] {
  return note.blocks.flatMap((b) => (b.kind === 'paragraph' ? b.content : b.kind === 'list' ? b.items.flat() : []))
}

function plainText(note: Note): string[] {
  const texts = note.blocks.flatMap((b) => (b.kind === 'heading' ? [b.text] : []))
  for (const i of inlines(note)) if (i.kind === 'text' || i.kind === 'strong' || i.kind === 'em' || i.kind === 'link') texts.push(i.text)
  return [note.title, ...texts]
}

/** Every principal-part cell a verb may have, in the usual order. */
export const PRINCIPAL_PARTS: string[][] = [
  ['pres.act.ind.1.sg', 'pres.mp.ind.1.sg'],
  ['fut.act.ind.1.sg', 'fut.mid.ind.1.sg'],
  ['aor.act.ind.1.sg', 'aor.mid.ind.1.sg'],
  ['perf.act.ind.1.sg'],
  ['perf.mp.ind.1.sg'],
  ['aor.pass.ind.1.sg'],
]

/**
 * What is wrong with a note: a title that is not the topic's, no Smyth citation, a placeholder or
 * link that does not resolve, or Greek typed into the prose (more than two letters in a row).
 */
export function noteProblems(note: Note, data: Paradigms): string[] {
  const problems: string[] = []
  if (!isNoteTopic(note.topic)) problems.push(`unknown topic ${note.topic}`)
  else if (note.title !== NOTE_TITLES[note.topic as NoteTopic]) problems.push(`title should be "${NOTE_TITLES[note.topic as NoteTopic]}"`)
  const all = [...plainText(note)].join(' ')
  if (!/Smyth §\d+/.test(all)) problems.push('no Smyth citation (Smyth §N)')
  for (const run of stripAll(all).match(/\p{Script=Greek}{3,}/gu) ?? []) problems.push(`Greek typed in the prose: ${run}`)
  const lemma = (ref: string) => {
    const l = data.lemma(ref)
    if (!l) problems.push(`no lemma ${ref}`)
    return l
  }
  for (const i of inlines(note)) {
    if (i.kind === 'word') lemma(i.ref)
    if (i.kind === 'form') {
      const l = lemma(i.ref)
      if (!i.cells.length) problems.push(`{{form ${i.ref}}} names no cell`)
      for (const c of i.cells) if (l && !data.forms(l, c).length) problems.push(`no form ${i.ref} ${c}`)
    }
    if (i.kind === 'link' && !isNoteTopic(i.topic)) problems.push(`link to unknown note ${i.topic}`)
  }
  for (const b of note.blocks) {
    if (b.kind === 'table') {
      const l = lemma(b.ref)
      if (l && (l.pos === 'verb') !== (b.block !== null)) problems.push(`{{table ${b.ref}}}: a verb needs a tense-voice block, a nominal none`)
      if (l && b.block && !data.blocks(l).includes(b.block)) problems.push(`no block ${b.ref} ${b.block}`)
    }
    if (b.kind === 'parts') for (const r of b.refs) if (lemma(r)?.pos !== 'verb') problems.push(`{{parts}}: ${r} is not a verb`)
  }
  return problems
}
