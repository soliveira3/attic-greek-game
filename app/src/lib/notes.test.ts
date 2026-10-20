import { describe, expect, it } from 'vitest'
import { ADJ_CLASSES, NOUN_CLASSES, VERB_CLASSES } from './features'
import { NOTE_TITLES, NOTE_TOPICS, classTopic, isNoteTopic, topicFor } from './notes'

describe('grammar note topics', () => {
  it('gives every topic a title and every class a note', () => {
    for (const t of NOTE_TOPICS) expect(NOTE_TITLES[t].length).toBeGreaterThan(0)
    for (const c of ['article', ...NOUN_CLASSES, ...ADJ_CLASSES, ...VERB_CLASSES] as const) {
      expect(NOTE_TOPICS).toContain(classTopic(c))
    }
  })
  it('groups related classes', () => {
    expect(classTopic('decl1-eta')).toBe(classTopic('decl1-masc-as'))
    expect(classTopic('decl3-velar')).toBe(classTopic('decl3-nt'))
    expect(classTopic('decl3-s')).not.toBe(classTopic('decl3-velar'))
    expect(classTopic('adj-3-es')).toBe(classTopic('adj-3-on'))
  })
  it('recognises topic ids', () => {
    expect(isNoteTopic('augment')).toBe(true)
    expect(isNoteTopic('nonsense')).toBe(false)
  })
})

describe('topicFor', () => {
  it('sends nominal slips to the class note, accent and breathing slips to the accent note', () => {
    expect(topicFor('decl2-mf', 'gen.sg', 'ending')).toBe('decl2')
    expect(topicFor('decl2-mf', 'gen.sg', 'stem')).toBe('decl2')
    expect(topicFor('decl3-velar', 'dat.sg', 'subscript')).toBe('decl3-consonant')
    expect(topicFor('decl2-mf', 'gen.sg', 'accent')).toBe('accent')
    expect(topicFor('decl2-mf', 'gen.sg', 'breathing')).toBe('accent')
    expect(topicFor('article', 'gen.sg.m', null)).toBe('article')
  })
  it('sends verb slips to the note on what went wrong', () => {
    expect(topicFor('verb-thematic', 'aor.act.ind.1.sg', 'augment')).toBe('augment')
    expect(topicFor('verb-thematic', 'fut.act.ind.1.sg', 'stem')).toBe('principal-parts')
    expect(topicFor('verb-thematic', 'pres.act.inf', 'ending')).toBe('infinitives')
    expect(topicFor('verb-thematic', 'aor.pass.ind.3.sg', 'ending')).toBe('middle-passive')
    expect(topicFor('verb-thematic', 'aor.mid.ind.3.sg', 'ending')).toBe('aorist')
    expect(topicFor('verb-thematic', 'perf.mp.ind.3.sg', 'ending')).toBe('perfect')
    expect(topicFor('verb-thematic', 'impf.act.ind.3.pl', 'ending')).toBe('verb-endings')
    expect(topicFor('verb-thematic', 'pres.mp.ind.2.sg', 'parse')).toBe('verb-endings')
    expect(topicFor('verb-thematic', 'pres.act.ind.1.sg', 'accent')).toBe('accent')
  })
})
