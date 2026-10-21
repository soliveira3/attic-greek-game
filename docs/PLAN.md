# Attic Greek Morphology Game — Master Plan

This is the roadmap Claude Code follows to build the project from an empty folder to a finished,
deployed game. Work through the phases **in order**. Each phase ends with acceptance criteria;
do not start the next phase until every box in the current one is checked.

Steps marked **🧑 HUMAN GATE** need the user to act or approve. Stop at them, explain clearly
what you need, and wait.

---

## 0. Ground rules (read before every phase)

1. **Never generate Greek forms from memory.** Every form shown to the player or used in a test
   comes from `data/paradigms/*.json`, which is built only from source data (Wiktionary via
   kaikki.org), and is cross-checked against Morpheus. If a form is missing or doubtful, flag it.
   Do not fill it in.
2. **Unicode discipline.** All Greek strings are stored NFC-normalized, with full accents,
   breathings and iota subscripts. All comparisons go through one `normalize()` module.
3. **TDD.** Write a failing test before writing each piece of code (Superpowers enforces this).
4. **Small commits.** Commit after each task, using a conventional message (`feat:`, `fix:`,
   `data:`, `test:`).
5. **Use the Superpowers workflow:** `/superpowers:write-plan` → review → `/superpowers:execute-plan`
   for each phase below. Save each phase plan to `docs/plans/phase-N.md`.
6. **Use the `greek-checker` subagent** after any change to `data/` or to the answer-checking
   logic.
7. Keep `docs/PROGRESS.md` updated: phase, what's done, open questions, and known data issues.

---

## Tech stack (decided; don't relitigate)

| Layer | Choice |
|---|---|
| Data pipeline | Python 3.11+, `pytest`, `libmorpheus` (cross-check only) |
| App | Vite + React + TypeScript, static site, no backend |
| Tests | Vitest + React Testing Library; Playwright for one smoke test |
| Spaced repetition | `ts-fsrs` |
| Persistence | `localStorage` (wrapped in try/catch), with JSON export/import of progress |
| Styling | Plain CSS modules. Use a polytonic-capable font (e.g. Gentium Plus or Noto Serif, which support polytonic Greek) |
| Deploy | GitHub Pages via GitHub Actions |

---

## Repository layout (target)

```
attic-greek-game/
├── CLAUDE.md
├── .claude/
│   ├── settings.json            # Stop hook → scripts/check.sh
│   └── agents/greek-checker.md
├── scripts/check.sh             # runs all tests; used by the hook and by CI
├── docs/
│   ├── PLAN.md                  # this file
│   ├── SPEC.md                  # written in Phase 1
│   ├── PROGRESS.md
│   ├── DATA_SOURCES.md          # licenses + attribution
│   └── plans/phase-N.md
├── pipeline/                    # Python
│   ├── raw/                     # downloaded dumps (git-ignored)
│   ├── build_paradigms.py
│   ├── crosscheck_morpheus.py
│   └── tests/
├── data/
│   ├── core_list.csv            # DCC Greek Core lemmas
│   ├── paradigms/{nouns,adjectives,verbs}.json
│   ├── golden/                  # human-verified forms (the ground truth for tests)
│   └── grammar/*.md             # short explanations shown in-game
└── app/                         # Vite + React + TS
    └── src/{lib,modes,components,srs}/
```

---

## Phase 0 — Scaffold (≈30 min)

Tasks
- `git init`; add `.gitignore` (node_modules, pipeline/raw, .venv, dist).
- Create `app/` with Vite React-TS; add Vitest; add an `npm test` script.
- Create `pipeline/` with a venv, `requirements.txt` (`pytest`, `libmorpheus`), and an empty test.
- Make sure `scripts/check.sh` runs both suites and exits non-zero on failure.
- Create `docs/PROGRESS.md` and `docs/DATA_SOURCES.md`.

Acceptance
- [ ] `bash scripts/check.sh` passes on the empty project
- [ ] First commit made

---

## Phase 1 — Spec (≈1 hr) 🧑 HUMAN GATE

Run `/superpowers:brainstorm` using the feature list below as the starting point. Ask the user
about anything ambiguous, especially scope, accent strictness, and what "done" means for v1.
Write the result to `docs/SPEC.md`.

v1 grammar scope (the proposed default):
- **Nouns:** 1st declension (α-, η-, short-α, masculine -ης/-ας), 2nd declension
  (masculine/feminine -ος, neuter -ον), and 3rd declension (consonant stems; then σ-stems,
  ι/υ-stems, ευ-stems).
- **Article** ὁ ἡ τό.
- **Adjectives:** 2-1-2 (-ος -η/-α -ον), 2-2 (compound -ος -ον), 3rd declension (-ης -ες, -ων -ον).
- **Verbs:** thematic ω-verbs (λύω-type); present, imperfect, future, aorist (1st and 2nd),
  perfect; active, middle, passive; indicative, then infinitives. Contract verbs (-άω -έω -όω)
  and εἰμί as stretch goals.

v1 game modes:
1. **Parse it.** Show a form; the player selects its features (case/number/gender, or
   person/number/tense/voice/mood). Count every valid parse as correct (e.g. a form that is
   both nominative and accusative plural).
2. **Fill the table.** Show a full paradigm grid with some cells blank, and have the player
   type the forms.
3. **Make it.** Show a lemma and target features; the player types the form.
4. **Endings sprint.** A 60-second timed round on endings only, by declension or conjugation.
5. **Review.** An FSRS queue built from the *features* the player gets wrong
   (e.g. "aorist middle 3rd plural"), not just individual words.

Answer-checking modes: **strict** (everything must match), **ignore accents** (breathings and
iota subscript still count), and **lenient** (ignore all diacritics). The default is
"ignore accents."

Typing Greek: provide an on-screen polytonic keyboard plus a beta-code/transliteration input
(e.g. `lu/w` → λύω), so the player needs no OS Greek keyboard.

Acceptance
- [ ] `docs/SPEC.md` written and **approved by the user**

---

## Phase 2 — Data pipeline (≈half a day) 🧑 HUMAN GATE

Tasks
1. **Core list.** Get the DCC Greek Core Vocabulary (Francese, dcc.dickinson.edu/greek-core-list)
   into `data/core_list.csv` with columns lemma, POS, gloss, and frequency rank. If the page can't
   be fetched from the sandbox, ask the user to save it and attach it.
2. **Wiktionary data.** Get the kaikki.org Ancient Greek JSONL dump into `pipeline/raw/`.
   If the network blocks it, ask the user to download it from kaikki.org (Ancient Greek →
   the JSONL download link) and attach it.
3. `build_paradigms.py`:
   - stream the JSONL; keep entries whose `word` is in the core list and whose POS matches
   - read `forms[]` with their `tags`; drop the `table-tags`, `inflection-template` and
     romanization rows
   - map tags to a canonical feature schema (TypeScript type shared with the app):
     `{case, number, gender}` for nominals; `{tense, voice, mood, person, number}` for verbs
   - record the declension/conjugation class and Wiktionary's dialect labels; **keep Attic only**
   - emit `data/paradigms/*.json` plus a `data/paradigms/REPORT.md` that lists lemmas with
     missing cells, multiple competing forms, or non-Attic forms
4. `crosscheck_morpheus.py`: run every generated form through Morpheus and confirm it parses back
   to the same lemma and features. Write mismatches to `REPORT.md`. Do not auto-fix them.
5. **Golden set.** Pick the model paradigms (λόγος, δῶρον, χώρα, τιμή, θάλαττα, πολίτης, φύλαξ,
   ἀγαθός, ἀληθής, λύω, plus one 2nd aorist and one 3rd-declension noun of each type). Copy their
   generated tables into `data/golden/*.json`, marked `"verified": false`.
6. 🧑 **HUMAN GATE:** ask the user to check the golden tables against Smyth's *Greek Grammar* (or
   their textbook) and set `"verified": true`. Tests run only against verified golden files.
7. Fill in `docs/DATA_SOURCES.md` with Wiktionary (CC BY-SA, attribution required), the DCC list,
   and Morpheus.

Acceptance
- [ ] pytest: schema validation on all paradigm files; golden files match generated data exactly
- [ ] REPORT.md reviewed; doubtful lemmas excluded via `data/exclude.txt` (not hand-edited forms)
- [ ] greek-checker subagent run, findings addressed
- [ ] User has verified the golden set

---

## Phase 3 — Core library (≈half a day)

`app/src/lib/`, all test-first:
- `normalize.ts`: NFC; final-sigma handling; strip-accents (keep breathings/subscript);
  strip-all-diacritics
- `betacode.ts`: transliteration → polytonic (tests: round-trip on every golden form)
- `features.ts`: the shared feature schema, display labels, and grouping
- `check.ts`: compare an answer to *all* valid forms for a prompt under the chosen strictness;
  return what was wrong (accent vs. ending vs. stem) so the UI can explain it
- `data.ts`: load the paradigms and query by lemma, features, or class

Acceptance
- [ ] ≥95% coverage on `lib/`
- [ ] Every golden form passes `check()` under all three strictness modes
- [ ] Ambiguous forms (e.g. same nominative and accusative) accept every valid parse

---

## Phase 4 — Game modes (≈1 day)

Build in this order, each as its own task with component tests:
1. App shell: home screen, settings (strictness, scope filters by declension/tense), Greek
   keyboard component
2. **Parse it**
3. **Fill the table**
4. **Make it**
5. **Endings sprint**

Every mode records each attempt as `{itemKey, featureKey, correct, errorKind, ts}`.

Acceptance
- [ ] Each mode is playable end-to-end with keyboard only
- [ ] Wrong answers show the correct form, highlight the differing part, and link to the
      grammar note
- [ ] Playwright smoke test plays one round of each mode

---

## Phase 5 — Spaced repetition and progress (≈half a day)

- Integrate `ts-fsrs`. Cards are **feature cells** (e.g. "1st decl. fem. gen. pl.") and
  **lemma×cell** items; a weak feature pulls in new lemmas that share it.
- Review mode draws its daily queue from FSRS.
- Stats page: accuracy by feature grid (heat map of the paradigm table), streak, and items due.
- Export/import progress as JSON.

Acceptance
- [ ] FSRS scheduling unit-tested with a fake clock
- [ ] Progress survives reload; the app still works if localStorage throws

---

## Phase 6 — Grammar notes (≈half a day) 🧑 HUMAN GATE

- `data/grammar/*.md`: one short note per topic (declension classes, augment, aorist stems,
  middle vs. passive, accent basics, contraction). Write them in your own words, citing Smyth
  section numbers.
- The greek-checker reviews them; the user approves them.

Acceptance
- [ ] Every feature in scope links to a note
- [ ] User approved the notes

---

## Phase 7 — Polish and ship (≈half a day)

- Accessibility pass (focus order, labels, contrast), mobile layout, dark mode
- Load and render polytonic Greek correctly (check combining characters render in the chosen font)
- GitHub Actions: run `scripts/check.sh` and deploy `app/dist` to GitHub Pages on `main`
- README: what it is, how to run it, data sources and licenses
- 🧑 **HUMAN GATE:** the user creates the GitHub repo and enables Pages (Claude must not create
  accounts or change repository settings on its own)

Acceptance
- [x] CI green; site live (2026-10-21)
- [x] `docs/PROGRESS.md` marked v1 complete, with a backlog for v2

---

## Phase 8 — Professional audit (added 2026-10-20 at the user's request) 🧑 HUMAN GATE

Done before the Phase 7 gate closes, so what goes public is already audited. Plan:
`docs/plans/phase-8.md`. CI that explains its failures, lint in the checks, a code review,
site metadata and a CSP, contributor documents and templates, README screenshots, a performance
measurement, and a review kit for a Greek teacher and learners.

Acceptance: see `docs/plans/phase-8.md`. The gate is shared with Phase 7.

---

## v2 backlog (not in scope; record ideas here)
Contract verbs and εἰμί (if not done in v1) · μι-verbs · participles · subjunctive/optative/
imperative · pronouns · comparatives · sentence-level parsing from real texts (e.g. Xenophon)
· accent-placement drills · audio.
