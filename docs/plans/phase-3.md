# Phase 3 — Core library: implementation plan

Goal: `app/src/lib/` provides everything the game modes need, test-first, with ≥95% coverage.
Greek in tests comes from `data/paradigms/` or `data/golden/` (loaded, not typed), apart from
single letters and marks used to exercise the converters.

## Modules

1. **normalize.ts** — mirror of `pipeline/normalize.py`: `nfc`, `stripLength`, `stripAccents`
   (keeps breathings and iota subscript), `stripAll`, `finalSigma`, `key`, plus `canon` for typed
   answers (trim, NFC, lowercase, final sigma, no length marks) and `displayForm` (hides length
   marks when a vowel carries both macron and breve; optionally hides all length marks).
2. **betacode.ts** — `betaToGreek` (TLG letters; diacritics `) ( / \ = | +` and optional
   `_ ^` after the letter in any order; works on partly converted text so it can run on every
   keystroke; `s` becomes ς at word end) and `greekToBeta`. Test: round trip on every golden form.
3. **features.ts** — existing schema plus: `parseCellKey` / `cellKey`, display labels for cells,
   classes and blocks, ordering helpers, `featureKey` (class × cell, the unit of review).
4. **check.ts** — `checkAnswer(answer, validForms, strictness, context)` compares with *all*
   valid forms and returns `{ correct, exact, matched, closest, errorKind, notes, diff }`:
   - strictness per SPEC §6 (strict / ignore-accents / lenient);
   - `errorKind`: accent, breathing, subscript, augment, ending, stem, blank (most specific);
   - `notes`: what differed even when counted correct (e.g. the accent in ignore-accents mode);
   - `diff`: grapheme-cluster segments of the answer and of the closest valid form, for
     highlighting.
   `checkParse(selection, validParses)` for Parse it: correct if the selection matches any
   valid parse; a shared middle/passive cell accepts either voice.
5. **data.ts** — loads the three paradigm files (dynamic import, so they become separate
   chunks), indexes lemmas by id/pos/class, `formsOf(lemma, key)`, `parsesOf(lemma, form)`,
   `blocks(lemma)` (verb tense-voice groups), `stemLength(lemma, keys)`, `find(query)` by
   features, and scope filtering (dual off by default).

## Acceptance
- [x] ≥95% coverage on `lib/` (100% lines, ~98% branches; enforced by scripts/check.sh)
- [x] Every golden form passes `check()` under all three strictness modes (every stored form, in fact)
- [x] Ambiguous forms (e.g. same nominative and accusative) accept every valid parse
- [x] greek-checker run on `check.ts` (three rounds), findings addressed or listed in PROGRESS
