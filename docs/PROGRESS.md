# Progress

| Phase | Status |
|---|---|
| 0 — Scaffold | done |
| 1 — Spec 🧑 | done (approved 2026-10-19) |
| 2 — Data pipeline 🧑 | done (golden set verified by the user 2026-10-19) |
| 3 — Core library | in progress |
| 4 — Game modes | not started |
| 5 — Spaced repetition & progress | not started |
| 6 — Grammar notes 🧑 | not started |
| 7 — Polish & ship 🧑 | not started |

## Current task
Phase 3 — core library (see docs/plans/phase-3.md).

## Waiting on the user
(nothing)

## Decisions taken
- 2026-10-19: after the user replied "continue" to the recommendations, ἐγενήθην (γίγνομαι) and
  the older spellings βασιλῆς, ἱππῆς and the dual πόλη were excluded (see the "User decisions"
  block in data/exclude.txt; delete those lines to undo), and golden verification goes through
  an automated comparison with Smyth (option 2) instead of a manual check.
- 2026-10-19: the user marked all 24 golden files verified on the evidence of
  data/golden/SMYTH_COMPARISON.md.

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
- 282 lemmas built: 129 nouns, 67 adjectives + the article, 85 thematic verbs; every v1 class
  has at least one lemma. Extra model lemmas not on the DCC list: `data/extra_lemmas.csv`.
- Morpheus agrees on 12,182 of 12,343 forms. Every remaining disagreement (in
  `data/paradigms/morpheus.json`) is explained in `data/morpheus_reviewed.txt`; a test enforces it.
- Verb tables are chosen per tense and voice from the DCC principal parts
  (`pipeline/select_tables.py` docstring has the rules); nominals use the first Attic table.
- Three greek-checker audits run (2026-10-19); all blockers and majors addressed. A perfect active
  is kept only with its own DCC principal part when DCC gives the perfect middle.

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
- 2026-10-19 — Phase 2 done: all 24 golden files verified (user decision); golden tests active.
- 2026-10-19 — Phase 2: user decisions applied; golden models δίκαιος/σώφρων replaced by Smyth's
  ἄξιος/εὐδαίμων; golden set compared with Smyth via Perseus (pipeline/smyth.py,
  compare_smyth.py): no differences.
- 2026-10-19 — Phase 2: three greek-checker audits; verb tables now chosen by DCC principal parts;
  exclusions extended; golden set regenerated (still unverified).
- 2026-10-19 — Phase 2: DCC list + kaikki dump fetched; pipeline (normalize, betacode, core
  list, table selection, tag mapping, classification, exclusions, Morpheus cross-check, golden
  generation) built test-first; REPORT reviewed and data/exclude.txt written; 24 golden files
  generated unverified.
- 2026-10-19 — Phase 1: SPEC.md written from the plan defaults (user chose default scope,
  ignore-accents default, plan-as-written "done", all in-scope DCC lemmas) and approved.
- 2026-10-19 — Phase 0: git repo, Vite React-TS app with Vitest + RTL, pipeline venv with pytest
  and libmorpheus, check.sh runs both suites (verified it exits 1 on a failing test).
