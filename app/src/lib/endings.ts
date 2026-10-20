// Endings for the Endings sprint (SPEC §5), derived from the verified golden model paradigms
// (data/golden/*.json): within a set (a declension class, or one tense-voice block of a model
// verb), the ending of a form is what follows the letters every form of the set shares.

import { stemLength } from './data'
import { type LemmaClass, blockLabel, classLabel } from './features'
import { canon, stripAccents, stripAll } from './normalize'

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
  cells: Record<string, string[]>
}

export interface SprintItem {
  set: string
  cell: string
  forms: string[]
  /** Accent-free endings (breathing and iota subscript kept); any of them is right. */
  endings: string[]
}

// 3rd-declension consonant stems fuse stem and ending in these cells (φύλαξ, φύλαξι).
const FUSED_CLASSES = new Set<LemmaClass>(['decl3-labial', 'decl3-velar', 'decl3-dental', 'decl3-nt', 'decl3-liquid'])
const FUSED_CELLS = ['nom.sg', 'voc.sg', 'dat.pl']

/** The verified golden models, the article left out (it has no stem/ending split to drill). */
export function goldenModels(): GoldenModel[] {
  const files = import.meta.glob<GoldenModel>('../../../data/golden/*.json', { eager: true, import: 'default' })
  return Object.values(files)
    .filter((m) => m.verified && m.class !== 'article')
    .sort((a, b) => a.lemma.localeCompare(b.lemma))
}

/** What follows the first `letters` letters of a form, without accents. */
function tail(form: string, letters: number): string {
  const clusters: string[] = []
  for (const ch of form.normalize('NFD')) {
    if (/\p{M}/u.test(ch) && clusters.length) clusters[clusters.length - 1] += ch
    else clusters.push(ch)
  }
  return stripAccents(clusters.slice(letters).join(''))
}

function makeSet(model: GoldenModel, block: string | null, cells: Record<string, string[]>): SprintSet {
  const nominative = new Set(cells['nom.sg'] ?? [])
  const fused = (k: string, forms: string[]) =>
    FUSED_CLASSES.has(model.class) && (FUSED_CELLS.includes(k) || forms.every((f) => nominative.has(f)))
  const keep = Object.fromEntries(Object.entries(cells).filter(([k, forms]) => !fused(k, forms)))
  const forms = Object.values(keep).flat()
  const n = stemLength(forms)
  return {
    id: `${model.lemma}:${block ?? model.class}`,
    cls: model.class,
    lemma: model.lemma,
    block,
    label: classLabel(model.class) + (block ? ` — ${blockLabel(block)}` : ''),
    stem: stripAll(forms[0] ?? '').slice(0, n),
    stemLength: n,
    cells: keep,
  }
}

function endingsKey(set: SprintSet): string {
  return sprintItems(set, { dual: true })
    .map((i) => `${i.cell}=${i.endings.join('/')}`)
    .join(';')
}

/**
 * One set per nominal model; for verbs, one per indicative tense-voice block of the fullest model
 * verb. Other model verbs add only aorist blocks whose endings differ (λείπω: the 2nd aorist).
 */
export function sprintSets(models: GoldenModel[]): SprintSet[] {
  const sets: SprintSet[] = []
  const seen = new Set<string>()
  const nominals = models.filter((m) => m.pos !== 'verb')
  // the fullest model verb first, so the others only add what differs
  const verbs = models.filter((m) => m.pos === 'verb').sort((a, b) => Object.keys(b.cells).length - Object.keys(a.cells).length)
  for (const model of [...nominals, ...verbs]) {
    if (model.pos !== 'verb') {
      sets.push(makeSet(model, null, model.cells))
      continue
    }
    const blocks = [...new Set(Object.keys(model.cells).filter((k) => k.includes('.ind.')).map((k) => k.split('.').slice(0, 2).join('.')))]
    for (const block of blocks) {
      // a later model verb adds only its own aorist (λείπω: the 2nd aorist)
      if (model !== verbs[0] && !block.startsWith('aor.')) continue
      const cells = Object.fromEntries(Object.entries(model.cells).filter(([k]) => k.startsWith(`${block}.ind.`)))
      const set = makeSet(model, block, cells)
      const k = `${block}|${endingsKey(set)}`
      if (seen.has(k)) continue
      seen.add(k)
      sets.push(set)
    }
  }
  return sets
}

export function sprintItems(set: SprintSet, opts: { dual?: boolean } = {}): SprintItem[] {
  return Object.entries(set.cells)
    .filter(([cell]) => opts.dual || !cell.endsWith('.du'))
    .map(([cell, forms]) => ({
      set: set.id,
      cell,
      forms,
      endings: [...new Set(forms.map((f) => tail(f, set.stemLength)))].filter(Boolean),
    }))
    .filter((item) => item.endings.length > 0)
}

/** Accents are ignored in the sprint: they belong to the word, not the ending (SPEC §5). */
export function checkEnding(answer: string, item: SprintItem): boolean {
  const typed = stripAccents(canon(answer.replace(/^\s*[-‐–]/u, '')))
  return typed.length > 0 && item.endings.some((e) => stripAccents(canon(e)) === typed)
}
