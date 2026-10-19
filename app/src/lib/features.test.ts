import { describe, expect, it } from 'vitest'
import schema from '../../../pipeline/schema.json'
import {
  ADJ_CLASSES,
  AORIST_TYPES,
  CASES,
  GENDERS,
  MOODS,
  NOUN_CLASSES,
  NUMBERS,
  PERSONS,
  POS,
  TENSES,
  VERB_CLASSES,
  VOICE_GROUPS,
  VOICES,
} from './features'

const defs = schema.$defs

describe('features.ts mirrors pipeline/schema.json', () => {
  it.each([
    ['pos', POS, defs.pos.enum],
    ['case', CASES, defs.case.enum],
    ['number', NUMBERS, defs.number.enum],
    ['gender', GENDERS, defs.gender.enum],
    ['tense', TENSES, defs.tense.enum],
    ['voice', VOICES, defs.voice.enum],
    ['voiceGroup', VOICE_GROUPS, defs.voiceGroup.enum],
    ['mood', MOODS, defs.mood.enum],
    ['person', PERSONS, defs.person.enum],
    ['aoristType', AORIST_TYPES, defs.aoristType.enum],
    ['nounClass', NOUN_CLASSES, defs.nounClass.enum],
    ['adjClass', ADJ_CLASSES, defs.adjClass.enum],
    ['verbClass', VERB_CLASSES, defs.verbClass.enum],
  ])('%s', (_name, ts, json) => {
    expect([...ts]).toEqual(json)
  })
})
