// Endings for the Endings sprint (SPEC §5), derived from the verified golden model paradigms
// (data/golden/*.json): within a set (a declension class, or one tense-voice block of a model
// verb), the ending of a form is what follows the letters every form of the set shares.

import { stemLength } from './data'
import { ADJ_CLASSES, type LemmaClass, NOUN_CLASSES, type Tense, type VoiceGroup, blockLabel, classLabel, parseCellKey } from './features'
import { adscript } from './check'
import { canon, key, stripAccents, stripAll, stripLength } from './normalize'
import type { Settings } from './settings'

export interface GoldenModel {
  lemma: string
  pos: string
  class: LemmaClass
  verified: boolean
  cells: Record<string, string[]>
}

export interface SprintSet {
  id: string
  cls: LemmaClass
  lemma: string
  /** Tense-voice block for verbs ("aor.pass"); null for nominals. */
  block: string | null
  label: string
  /** Accent-free letters the set's forms share, and their number. */
  stem: string
  stemLength: number
  /** The shared letters for display: the first form's, breathing kept, accents dropped. */
  stemShown: string
  cells: Record<string, string[]>
}

export interface SprintItem {
  set: string
  cell: string
  forms: string[]
  /** Accent-free endings (breathing and iota subscript kept); any of them is right. */
  endings: string[]
  /**
   * Endings with the iota written on the line (-ωι for -ῳ), also right unless that spelling is
   * another cell's ending (-αι for the dative -ᾳ is the nominative plural).
   */
  onTheLine: string[]
}

// 3rd-declension consonant stems (nouns, and -ων -ον adjectives) fuse stem and ending in these
// cells (φύλαξ, φύλαξι); a cell equal to the nominative or vocative singular goes too (neuter acc.).
const FUSED_CLASSES = new Set<LemmaClass>(['decl3-labial', 'decl3-velar', 'decl3-dental', 'decl3-nt', 'decl3-liquid', 'adj-3-on'])
const FUSED_CELLS = ['nom.sg', 'voc.sg', 'dat.pl']
const caseNumber = (cell: string) => cell.split('.').slice(0, 2).join('.')

/** The verified golden models, the article left out (it has no stem/ending split to drill). */
export function goldenModels(): GoldenModel[] {
  const files = import.meta.glob<GoldenModel>('../../../data/golden/*.json', { eager: true, import: 'default' })
  return Object.values(files)
    .filter((m) => m.verified && m.class !== 'article')
    .sort((a, b) => a.lemma.localeCompare(b.lemma))
}

function clusters(form: string): string[] {
  const out: string[] = []
  for (const ch of form.normalize('NFD')) {
    if (/\p{M}/u.test(ch) && out.length) out[out.length - 1] += ch
    else out.push(ch)
  }
  return out
}

/** What follows the first `letters` letters of a form, without accents. */
function tail(form: string, letters: number): string {
  return stripAccents(clusters(form).slice(letters).join(''))
}

function makeSet(model: GoldenModel, block: string | null, cells: Record<string, string[]>, label: string): SprintSet {
  const nominatives = new Set(
    Object.entries(cells)
      .filter(([k]) => ['nom.sg', 'voc.sg'].includes(caseNumber(k)))
      .flatMap(([, forms]) => forms.map(key)),
  )
  const fused = (k: string, forms: string[]) =>
    FUSED_CLASSES.has(model.class) && (FUSED_CELLS.includes(caseNumber(k)) || forms.every((f) => nominatives.has(key(f))))
  const keep = Object.fromEntries(Object.entries(cells).filter(([k, forms]) => !fused(k, forms)))
  const forms = Object.values(keep).flat()
  // the letters all forms share, short enough to leave every form an ending (ἐλυθ-η, not ἐλυθη-)
  let n = stemLength(forms)
  while (n > 0 && forms.some((f) => clusters(f).length <= n)) n--
  return {
    id: `${model.lemma}:${block ?? model.class}`,
    cls: model.class,
    lemma: model.lemma,
    block,
    label,
    stem: stripAll(forms[0] ?? '').slice(0, n),
    stemLength: n,
    stemShown: stripAccents(stripLength(clusters(forms[0] ?? '').slice(0, n).join(''))),
    cells: keep,
  }
}

function endingsKey(set: SprintSet): string {
  return sprintItems(set, { dual: true })
    .map((i) => `${i.cell}=${i.endings.join('/')}`)
    .join(';')
}

/** "1st aorist active" when the model verb has one aorist type; otherwise the block's label. */
function verbLabel(model: GoldenModel, block: string, types: readonly string[] | undefined): string {
  const ordinal = types?.length === 1 && block !== 'aor.pass' && block.startsWith('aor.') ? `${types[0] === '1' ? '1st' : '2nd'} ` : ''
  return `${classLabel(model.class)} — ${ordinal}${blockLabel(block)}`
}

function nominalLabel(model: GoldenModel): string {
  const label = classLabel(model.class)
  // a noun whose nominative is its accusative is neuter: say so where the class also has m./f. nouns
  const same = (a: string[] = [], b: string[] = []) => a.length > 0 && a.map(key).join() === b.map(key).join()
  const neuter = model.pos === 'noun' && !label.includes('neuter') && same(model.cells['nom.sg'], model.cells['acc.sg'])
  return neuter ? `${label} (neuter)` : label
}

/**
 * One set per nominal model; for verbs, one per indicative tense-voice block of the main model
 * verb (a 1st-aorist verb, given `aoristTypes` from the paradigm data: lemma → aorist types).
 * Other model verbs add only aorist blocks whose endings differ (λείπω: the 2nd aorist).
 */
export function sprintSets(models: GoldenModel[], aoristTypes: Record<string, readonly string[]> = {}): SprintSet[] {
  const sets: SprintSet[] = []
  const seen = new Set<string>()
  const order: readonly string[] = [...NOUN_CLASSES, ...ADJ_CLASSES]
  const nominals = models.filter((m) => m.pos !== 'verb').sort((a, b) => order.indexOf(a.class) - order.indexOf(b.class))
  // a 1st-aorist verb first, then the fullest, so the others only add what differs
  const firstAorist = (m: GoldenModel) => (aoristTypes[m.lemma]?.join() === '1' ? 0 : 1)
  const verbs = models
    .filter((m) => m.pos === 'verb')
    .sort((a, b) => firstAorist(a) - firstAorist(b) || Object.keys(b.cells).length - Object.keys(a.cells).length || a.lemma.localeCompare(b.lemma))
  for (const model of [...nominals, ...verbs]) {
    if (model.pos !== 'verb') {
      sets.push(makeSet(model, null, model.cells, nominalLabel(model)))
      continue
    }
    const blocks = [...new Set(Object.keys(model.cells).filter((k) => k.includes('.ind.')).map((k) => k.split('.').slice(0, 2).join('.')))]
    for (const block of blocks) {
      // a later model verb adds only its own aorist (λείπω: the 2nd aorist)
      if (model !== verbs[0] && !block.startsWith('aor.')) continue
      const cells = Object.fromEntries(Object.entries(model.cells).filter(([k]) => k.startsWith(`${block}.ind.`)))
      const known = aoristTypes[model.lemma]
      const label = model === verbs[0] || known ? verbLabel(model, block, known) : `${verbLabel(model, block, known)} (like ${model.lemma})`
      const set = makeSet(model, block, cells, label)
      const k = `${block}|${endingsKey(set)}`
      if (seen.has(k)) continue
      seen.add(k)
      sets.push(set)
    }
  }
  return sets
}

const plain = (e: string) => stripAccents(canon(e))

export function sprintItems(set: SprintSet, opts: { dual?: boolean } = {}): SprintItem[] {
  const all = Object.entries(set.cells)
    .map(([cell, forms]) => ({ cell, forms, endings: [...new Set(forms.map((f) => tail(f, set.stemLength)))].filter(Boolean) }))
    .filter((item) => item.endings.length > 0)
  return all
    .filter(({ cell }) => opts.dual || parseCellKey(cell).number !== 'du')
    .map((item) => {
      const taken = new Set(all.flatMap((o) => o.endings.map(plain)))
      const onTheLine = item.endings.map((e) => plain(adscript(e))).filter((e) => !taken.has(e))
      return { set: set.id, ...item, onTheLine: [...new Set(onTheLine)] }
    })
}

/**
 * Accents are ignored in the sprint: they belong to the word, not the ending (SPEC §5). Iota
 * written on the line is accepted, as in answer checking outside strict mode (SPEC §6), unless
 * that spelling is another ending of the set.
 */
export function checkEnding(answer: string, item: SprintItem): boolean {
  const typed = stripAccents(canon(answer.replace(/^\s*[-‐–]/u, '')))
  return typed.length > 0 && [...item.endings, ...item.onTheLine].some((e) => plain(e) === typed)
}

/** The part of speech of a set's model word. */
export function setPos(set: SprintSet): 'noun' | 'adj' | 'verb' {
  return set.block ? 'verb' : set.cls.startsWith('adj') ? 'adj' : 'noun'
}

/** The sets of the parts of speech, classes, tenses and voices being drilled. */
export function setsInScope(sets: SprintSet[], scope: Settings['scope']): SprintSet[] {
  return sets.filter((set) => {
    if (!scope.pos.includes(setPos(set))) return false
    if (scope.classes.length && !scope.classes.includes(set.cls)) return false
    if (!set.block) return true
    const [tense, group] = set.block.split('.')
    return scope.tenses.includes(tense as Tense) && scope.voices.includes(group as VoiceGroup)
  })
}
