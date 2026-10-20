import { describe, expect, it } from 'vitest'
import adjectives from '../../../data/paradigms/adjectives.json'
import nouns from '../../../data/paradigms/nouns.json'
import verbs from '../../../data/paradigms/verbs.json'
import { makeParadigms } from './data'
import { ADJ_CLASSES, NOUN_CLASSES, type ParadigmFile, VERB_CLASSES } from './features'
import { loadNotes, noteProblems, parseInline, parseNote } from './grammar'
import { NOTE_TOPICS, topicFor } from './notes'
import { betaToGreek } from './betacode'

const data = makeParadigms([nouns, adjectives, verbs] as unknown as ParadigmFile[])
const ref = `noun:${data.lemmasWhere({ classes: ['decl2-mf'] })[0].id}`

describe('parseNote', () => {
  it('reads the title, headings, paragraphs, lists and placeholders', () => {
    const n = parseNote('decl2', `# The 2nd declension\n\nSome **bold** and *em* text\ngoes on (Smyth §231).\n\n## Forms\n- one {{form ${ref} gen.sg dat.sg}}\n- two [the augment](augment)\n{{table ${ref}}}\n{{parts verb:x verb:y}}\nlast {{word ${ref}}}`)
    expect(n.title).toBe('The 2nd declension')
    expect(n.blocks.map((b) => b.kind)).toEqual(['paragraph', 'heading', 'list', 'table', 'parts', 'paragraph'])
    const p = n.blocks[0]
    expect(p.kind === 'paragraph' && p.content.map((i) => i.kind)).toEqual(['text', 'strong', 'text', 'em', 'text'])
    const list = n.blocks[2]
    expect(list.kind === 'list' && list.items[0][1]).toEqual({ kind: 'form', ref, cells: ['gen.sg', 'dat.sg'] })
    expect(list.kind === 'list' && list.items[1][1]).toEqual({ kind: 'link', text: 'the augment', topic: 'augment' })
    expect(n.blocks[3]).toEqual({ kind: 'table', ref, block: null })
    expect(n.blocks[4]).toEqual({ kind: 'parts', refs: ['verb:x', 'verb:y'] })
  })
  it('parses plain text as one text run', () => {
    expect(parseInline('plain')).toEqual([{ kind: 'text', text: 'plain' }])
  })
})

describe('noteProblems', () => {
  it('accepts a good note', () => {
    expect(noteProblems(parseNote('decl2', `# The 2nd declension\n\nSee {{form ${ref} gen.sg}} (Smyth §231).\n\n{{table ${ref}}}`), data)).toEqual([])
  })
  it('finds a wrong title, a missing citation, bad references and typed Greek', () => {
    const typed = betaToGreek('logou')
    const n = parseNote('decl2', `# Wrong\n\n${typed} {{form noun:nonexistent gen.sg}} {{form ${ref} nope}} {{form ${ref}}} [x](nope)\n\n{{table ${ref} pres.act}}\n{{table verb:λύω}}\n{{table verb:λύω nope.act}}\n{{parts ${ref}}}`)
    const problems = noteProblems(n, data).join('\n')
    for (const p of ['title should be', 'no Smyth citation', 'Greek typed', 'no lemma noun:nonexistent', 'no form', 'names no cell', 'unknown note', 'a verb needs', 'no block', 'is not a verb']) {
      expect(problems).toContain(p)
    }
    expect(noteProblems(parseNote('nope', '# x\n\nSmyth §1'), data)).toContain('unknown topic nope')
  })
})

describe('the notes in data/grammar', () => {
  const notes = loadNotes()
  it('there is one note per topic, and nothing else', () => {
    expect([...notes.keys()].sort()).toEqual([...NOTE_TOPICS].sort())
  })
  it.each([...NOTE_TOPICS])('%s has no problems', (topic) => {
    expect(noteProblems(notes.get(topic)!, data)).toEqual([])
  })
  it('every class and every error kind leads to a note', () => {
    const cells = ['nom.sg', 'pres.act.ind.1.sg', 'aor.pass.ind.3.pl', 'perf.mp.inf']
    for (const cls of ['article', ...NOUN_CLASSES, ...ADJ_CLASSES, ...VERB_CLASSES] as const) {
      for (const cell of cells) for (const kind of [null, 'accent', 'augment', 'stem', 'ending'] as const) expect(notes.has(topicFor(cls, cell, kind))).toBe(true)
    }
  })
})
