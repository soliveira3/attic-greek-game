// The real paradigm data for component tests (loaded synchronously, as the app does after start-up).
import adjectives from '../../../data/paradigms/adjectives.json'
import nouns from '../../../data/paradigms/nouns.json'
import verbs from '../../../data/paradigms/verbs.json'
import { type Paradigms, makeParadigms } from '../lib/data'
import type { ParadigmFile } from '../lib/features'

export const testData: Paradigms = makeParadigms([nouns, adjectives, verbs] as unknown as ParadigmFile[])
