# Progress

| Phase | Status |
|---|---|
| 0 — Scaffold | done |
| 1 — Spec 🧑 | done (approved 2026-10-19) |
| 2 — Data pipeline 🧑 | done (golden set verified by the user 2026-10-19) |
| 3 — Core library | done (2026-10-20) |
| 4 — Game modes | in progress |
| 5 — Spaced repetition & progress | done (2026-10-20) |
| 6 — Grammar notes 🧑 | not started |
| 7 — Polish & ship 🧑 | not started |

## Current task
Phase 4 task 10: address the greek-checker review of the endings and the modes (running), then
Phase 6 (grammar notes).

## Waiting on the user
(nothing)

## Decisions taken
- 2026-10-19: after the user replied "continue" to the recommendations, ἐγενήθην (γίγνομαι) and
  the older spellings βασιλῆς, ἱππῆς and the dual πόλη were excluded (see the "User decisions"
  block in data/exclude.txt; delete those lines to undo), and golden verification goes through
  an automated comparison with Smyth (option 2) instead of a manual check.
- 2026-10-19/20: SPEC §6 refined after the check.ts reviews (Claude's call, reversible): an answer
  that is exactly another drilled form of the same word is wrong in strict and ignore-accents mode
  (lenient accepts and mentions it); iota adscript is accepted with a note except in strict mode;
  typing aids for marks typed before letters or in another order; errors vs notes per mode.
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
- Playwright: `cd app && npx playwright install chromium` once; `npm run e2e` builds and serves
  the site on port 4173 and runs the smoke test.
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

## Known answer-checking label edge cases (from the third check.ts review; labels only, verdicts right)
- An augment carried into a non-past compound form (ἀπεκτεῖναι for ἀποκτεῖναι) is labelled stem or
  ending, not augment.
- A few compound aorist infinitive stems are measured short (διενεγκεῖν, παρασχεῖν, ἀποθανεῖν), so
  some stem slips there are labelled ending.
- A breathing typed before a consonant moves to the next vowel; any vowel added in front of a
  non-past form is labelled augment.
- When ignore-accents rejects another drilled form, the diff also highlights its accent.

## v2 backlog additions
- Periphrastic perfect middle/passive 3rd plural for consonant stems.

## Log
<!-- newest first: YYYY-MM-DD — what was done -->
- 2026-10-20 — Phase 5 done: smoke test also plays a Review round, reloads and finds the progress,
  and runs the app with a localStorage that throws.
- 2026-10-20 — Phase 5 tasks 4–5: Progress page (#/stats: day streak, due today, answers, accuracy
  heat maps laid out as each class's table, numbers shown as text; warning when the browser is
  not saving); export / import of all progress as JSON (validated, confirmation before replacing).
- 2026-10-20 — Phase 5 task 3: Review page (#/review; Make it format, counts left, a missed item
  comes back once at the end, "done for now" with the next review time); Home shows today's
  reviews.
- 2026-10-20 — Phase 5 tasks 1–2: FSRS cards (ts-fsrs 5.4.2) for feature cells and lemma × cell
  items, tested with a fake clock; daily Review queue (due first, then new items: weak feature
  cells pull in words of their class, then the most frequent words); every mode now updates the
  cards (right → Good, right only by the setting → Hard, wrong → Again); "new words a day" setting.
- 2026-10-20 — Phase 4 task 9: Playwright smoke test (app/e2e/smoke.spec.ts, desktop and phone)
  plays a round of each mode with the keyboard on the built site; part of scripts/check.sh
  (SKIP_E2E=1 skips it; needs `npx playwright install chromium` once).
- 2026-10-20 — Phase 4 task 8: Endings sprint (sets in scope grouped by part of speech, stem
  shown, 60-second clock, last answer shown with its endings, best score per set saved, Enter to
  play again).
- 2026-10-20 — Phase 4 task 7: Make it (one card component, reused by Review in Phase 5); a page
  keeps the focus it gives its answer box, other pages focus their heading.
- 2026-10-20 — Phase 4 task 6: Fill the table (grid per word or tense-voice block, a few / half /
  all blanks, Tab between blanks, Enter checks and Enter again moves on, each cell marked with
  its error and the right form highlighted, attempts recorded per cell).
- 2026-10-20 — Phase 4 task 5: Parse it (button groups with number keys, Enter to check and go on,
  any valid parse accepted, wrong features highlighted, every valid parse listed, attempts
  recorded). @playwright/test added for screenshots and the smoke test.
- 2026-10-20 — Phase 4 task 4: Feedback (verdict in plain words, highlighted diff, other valid
  forms, grammar-note link, Next); lib/notes.ts maps class, cell and error kind to a note topic.
- 2026-10-20 — Phase 4 task 3: app shell (hash router, AppProvider with loading/error states,
  Home, Settings, Notes placeholder, GreekInput converting beta code at the caret, on-screen
  keyboard, light/dark styles, Gentium Plus bundled from @fontsource, OFL).
- 2026-10-20 — Phase 4 tasks 1–2: storage (try/catch, memory fallback), settings, attempt log;
  seedable prompt generators (Parse it, Make it, Fill the table) honouring the scope settings;
  endings sprint sets derived from the verified golden models (λύω gives every block, λείπω adds
  its 2nd aorist; fused 3rd-declension cells, including a neuter's accusative, left out).
- 2026-10-20 — Phase 3 done: third check.ts review addressed (present typed for the imperfect is an
  augment error, not where the augment is invisible; rejected other forms list counted errors;
  trailing punctuation ignored). Remaining label edge cases listed under "Known ...".
- 2026-10-20 — Phase 3: second check.ts review addressed (other forms limited to the drill scope and
  not enforced in lenient; augment position from preverbs verified by the data; preverb slips are
  stem errors; infinitive stems; errors vs notes; two-level diff; more keyboard folding).
- 2026-10-19 — Phase 3: greek-checker review of check.ts addressed (crash on leading marks, missing
  error kinds, other-form acceptance, per-mood stems, augment detection incl. compounds, iota
  adscript, diff at the strictness level, Python/TS parity edges).
- 2026-10-19 — Phase 3: lib/ normalize (parity with the pipeline on every golden form), betacode
  (live typing), features (keys, labels), data (load/query), check (modes, error kinds, diff,
  Parse it); every golden form passes in all modes.
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
