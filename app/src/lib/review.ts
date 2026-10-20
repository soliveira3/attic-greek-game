// The daily Review queue (SPEC §8): items FSRS says are due, then new items up to the daily limit.

import type { Paradigms } from './data'
import { parseFeatureKey } from './features'
import { type MakePrompt, type Rng, lemmasInScope, makePromptFor } from './prompts'
import type { Settings } from './settings'
import { type SrsState, dueItems, hasCard, introducedOn, weakFeatures } from './srs'

export interface QueueEntry {
  prompt: MakePrompt
  /** First time this item is asked (counts against the daily new-card limit). */
  isNew: boolean
}

export function reviewQueue(data: Paradigms, settings: Settings, srs: SrsState, now: Date, rng: Rng): QueueEntry[] {
  const scope = { dual: settings.scope.dual, tenses: settings.scope.tenses, voices: settings.scope.voices }
  const lemmas = lemmasInScope(data, settings)
  const inScope = new Map(lemmas.map((l) => [l, new Map(data.cellsInScope(l, scope).map((c) => [c.key, c]))]))
  const queue: QueueEntry[] = []
  const taken = new Set<string>()

  // 1. due items still in the data and in scope
  for (const itemKey of dueItems(srs, now)) {
    const [ref, cellKey] = itemKey.split('|')
    const lemma = data.lemma(ref)
    const cell = lemma && inScope.get(lemma)?.get(cellKey)
    if (!lemma || !cell) continue
    queue.push({ prompt: makePromptFor(data, settings, lemma, cell), isNew: false })
    taken.add(itemKey)
  }

  // 2. new items, most frequent words first
  let budget = Math.max(0, settings.newPerDay - introducedOn(srs, now))
  const byRank = [...lemmas].sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity))
  const add = (entry: MakePrompt) => {
    queue.push({ prompt: entry, isNew: true })
    taken.add(entry.itemKey)
    budget--
  }
  const unseen = (lemma: (typeof lemmas)[number], cellKey: string) => {
    const prompt = inScope.get(lemma)?.get(cellKey)
    if (!prompt) return null
    const p = makePromptFor(data, settings, lemma, prompt)
    return hasCard(srs, p.itemKey) || taken.has(p.itemKey) ? null : p
  }
  // a weak feature cell pulls in words of its class that have not met that cell
  for (const featureKey of weakFeatures(srs, now)) {
    const { cls, cell } = parseFeatureKey(featureKey)
    for (const lemma of byRank) {
      if (budget <= 0) break
      if (lemma.class !== cls) continue
      const p = unseen(lemma, cell)
      if (p) {
        add(p)
        break
      }
    }
  }
  const used = new Set(queue.filter((e) => e.isNew).map((e) => e.prompt.lemma))
  for (const lemma of byRank) {
    if (budget <= 0) break
    if (used.has(lemma)) continue
    const fresh = [...inScope.get(lemma)!.keys()].map((k) => unseen(lemma, k)).filter((p): p is MakePrompt => p !== null)
    if (!fresh.length) continue
    add(fresh[Math.floor(rng() * fresh.length)])
  }
  return queue
}
