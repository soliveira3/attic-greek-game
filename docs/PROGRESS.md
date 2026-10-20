# Progress

| Phase | Status |
|---|---|
| 0 — Scaffold | done |
| 1 — Spec 🧑 | done (approved 2026-10-19) |
| 2 — Data pipeline 🧑 | pipeline done; 2 greek-checker audits addressed; **waiting on golden verification** |
| 3 — Core library | not started |
| 4 — Game modes | not started |
| 5 — Spaced repetition & progress | not started |
| 6 — Grammar notes 🧑 | not started |
| 7 — Polish & ship 🧑 | not started |

## Current task
Phase 2, human gate: golden verification. The user does not read Greek, so the verification
method is being agreed (options offered 2026-10-19: a Greek reader checks REVIEW.md; Claude
compares the golden tables with Smyth's paradigms and reports differences in plain language;
or rely on the automated checks).

## Waiting on the user
- Choose how the golden set gets verified (see above), then set `"verified": true` per file.
- Decide: keep or drop γίγνομαι's aorist passive ἐγενήθην (DCC lists it; Smyth calls it
  non-Attic). Recommended: drop.
- Decide: keep or drop the older Attic alternates βασιλῆς (pl. of βασιλεύς, currently shown
  first) and the dual πόλη (πόλις). Recommended: drop both.

## Open questions
- The Superpowers plugin is not installed, so phase plans in docs/plans/ are written by hand in
  the same shape. Install it with `/plugin install superpowers@claude-plugins-official` if you
  want the real skills used.

## Environment notes
- Node 22, Vite 8, React 19, TypeScript 7 (`tsc -b`), Vitest 5.
- Python 3.14 venv in pipeline/.venv; requirements: pytest, jsonschema, libmorpheus.
- `scripts/check.sh` type-checks with `tsc -b` (the template's root tsconfig has `files: []`,
  so `tsc --noEmit -p .` checked nothing).
- Raw inputs live in git-ignored `pipeline/raw/`: kaikki dump (404 MB), DCC page, Morpheus
  (`pipeline/fetch_morpheus.sh`). Tests that need them skip when absent. See docs/DATA_SOURCES.md.

## Data pipeline summary (Phase 2)
- 283 lemmas built: 129 nouns, 67 adjectives + the article, 85 thematic verbs; every v1 class
  has at least one lemma. Extra model lemmas not on the DCC list: `data/extra_lemmas.csv`.
- Morpheus agrees on 12,193 of 12,398 forms; every remaining disagreement is either excluded or
  listed as deliberately kept at the end of `data/exclude.txt`.
- Verb tables are chosen per tense and voice from the DCC principal parts
  (`pipeline/select_tables.py` docstring has the rules); nominals use the first Attic table.
- Two greek-checker audits run (2026-10-19); all blockers and majors addressed.

## Known data issues
See data/paradigms/REPORT.md and the commented rules in data/exclude.txt. Notable:
- Perfect middle/passive 3rd plural in -αται removed (Attic uses a periphrasis, not in v1); those
  perfect middle/passive blocks are kept with the 3rd plural blank.
- Some valid Attic alternates are lost where DCC lists only one principal part (e.g. λέγω
  εἴρημαι, πείθω πέπεικα, ἔχω σχήσομαι): precision is preferred over recall. A learner typing
  one of these is marked wrong; revisit if players report it.
- No present middle/passive infinitive for γιγνώσκω, ἔρχομαι, οἴομαι (source rows lack a voice).
- ἱερός carries stacked length marks (either-length); the app should hide length marks when a
  vowel has both macron and breve (display only).
- Contract verbs, εἰμί, μι-verbs, irregular nouns, comparatives, pronominal adjectives and 3-1-3
  adjectives are out of scope for now.

## v2 backlog additions
- Periphrastic perfect middle/passive 3rd plural for consonant stems.

## Log
<!-- newest first: YYYY-MM-DD — what was done -->
- 2026-10-19 — Phase 2: two greek-checker audits; verb tables now chosen by DCC principal parts;
  exclusions extended; golden set regenerated (still unverified).
- 2026-10-19 — Phase 2: DCC list + kaikki dump fetched; pipeline (normalize, betacode, core
  list, table selection, tag mapping, classification, exclusions, Morpheus cross-check, golden
  generation) built test-first; REPORT reviewed and data/exclude.txt written; 24 golden files
  generated unverified.
- 2026-10-19 — Phase 1: SPEC.md written from the plan defaults (user chose default scope,
  ignore-accents default, plan-as-written "done", all in-scope DCC lemmas) and approved.
- 2026-10-19 — Phase 0: git repo, Vite React-TS app with Vitest + RTL, pipeline venv with pytest
  and libmorpheus, check.sh runs both suites (verified it exits 1 on a failing test).
