# Progress

| Phase | Status |
|---|---|
| 0 — Scaffold | done |
| 1 — Spec 🧑 | done (approved 2026-10-19) |
| 2 — Data pipeline 🧑 | pipeline done; greek-checker review in progress; **waiting on golden verification** |
| 3 — Core library | not started |
| 4 — Game modes | not started |
| 5 — Spaced repetition & progress | not started |
| 6 — Grammar notes 🧑 | not started |
| 7 — Polish & ship 🧑 | not started |

## Current task
Phase 2, task 7/11: address greek-checker findings, then the human gate (golden verification).

## Waiting on the user
- Verify the 24 golden paradigms in `data/golden/` (grids in `data/golden/REVIEW.md`) against
  Smyth or a textbook, and set `"verified": true` in each file that is right. Report wrong cells
  instead of editing them.

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
- 300 lemmas built: 130 nouns, 84 adjectives + the article, 85 thematic verbs; every v1 class
  has at least one lemma. Extra model lemmas not on the DCC list: `data/extra_lemmas.csv`.
- Morpheus agrees on 12,983 of 13,326 forms; the rest are listed in REPORT.md (mostly Morpheus
  gaps: lemma spellings, vocative = nominative, perfect 3rd dual, comparatives).
- Rules worth knowing (details in docs/plans/phase-2.md and the module docstrings):
  first Attic table per tense used whole, later tables only fill missing voice groups;
  a "contracted X" table supersedes its uncontracted partner; "middle"-only present-system
  tags become middle/passive; homograph entries chosen by gloss overlap with the DCC gloss.

## Known data issues
See data/paradigms/REPORT.md and the commented rules in data/exclude.txt. Notable:
- Perfect middle/passive 3rd plural in -αται removed (Attic uses a periphrasis, not in v1), so
  38 verbs have no perfect middle/passive indicative block.
- Kept although Morpheus does not know them: τρέφω aor. pass. ἐθρέφθην, ἔχω fut./aor. passive.
- Contract verbs, εἰμί, μι-verbs, irregular nouns and 3-1-3 adjectives are out of scope for now.

## v2 backlog additions
- Periphrastic perfect middle/passive 3rd plural for consonant stems.

## Log
<!-- newest first: YYYY-MM-DD — what was done -->
- 2026-10-19 — Phase 2: DCC list + kaikki dump fetched; pipeline (normalize, betacode, core
  list, table selection, tag mapping, classification, exclusions, Morpheus cross-check, golden
  generation) built test-first; REPORT reviewed and data/exclude.txt written; 24 golden files
  generated unverified.
- 2026-10-19 — Phase 1: SPEC.md written from the plan defaults (user chose default scope,
  ignore-accents default, plan-as-written "done", all in-scope DCC lemmas) and approved.
- 2026-10-19 — Phase 0: git repo, Vite React-TS app with Vitest + RTL, pipeline venv with pytest
  and libmorpheus, check.sh runs both suites (verified it exits 1 on a failing test).
