# Architecture

The project has two halves joined by one set of JSON files. A Python pipeline turns open
sources into checked paradigm data. A static React app drills the player on that data. Nothing
runs on a server.

```
 Wiktionary (kaikki.org dump) ─┐
 DCC Greek Core list ──────────┼─▶ pipeline/ ─▶ data/paradigms/*.json ─┐
 Morpheus (cross-check only) ──┘        │       data/golden/*.json  ───┼─▶ app/ ─▶ app/dist (GitHub Pages)
 Smyth via Perseus (golden check) ──────┘       data/grammar/*.md  ────┘
```

## Pipeline (`pipeline/`, Python)

Run by hand when the sources change; its output is committed. Steps, in order:

| Module | Does |
|---|---|
| `core_list.py` | DCC Greek Core page → `data/core_list.csv` (lemma, part of speech, gloss, frequency rank) |
| `kaikki.py`, `tags.py` | Read Wiktionary inflection tables; map their tags to feature cells (`pipeline/schema.json`) |
| `select_tables.py` | Choose, per tense and voice, the verb tables that match the DCC principal parts |
| `classify.py` | Assign each word its declension or conjugation class |
| `exclusions.py` | Apply `data/exclude.txt`: remove doubtful words, tenses or forms (never edit one) |
| `build_paradigms.py` | Write `data/paradigms/{nouns,adjectives,verbs}.json` and `REPORT.md` |
| `crosscheck_morpheus.py` | Parse every form back with Morpheus; record and explain every disagreement |
| `make_golden.py`, `compare_smyth.py`, `smyth.py` | Copy the model paradigms to `data/golden/`; compare them with Smyth |
| `normalize.py`, `betacode.py` | Unicode rules shared with the app; `export_parity.py` proves both sides agree |

pytest checks the schema, that golden files match the generated data exactly, that every
Morpheus disagreement is explained, and the parity fixture used by the app's tests.

## App (`app/`, Vite + React + TypeScript)

| Layer | Where | Does |
|---|---|---|
| Domain logic | `src/lib/` | Pure functions, tested to ≥95 % coverage: normalisation, beta code, the feature schema (`features.ts`, the single source of truth), data queries, answer checking (`check.ts`), prompts, the learning path, FSRS scheduling, statistics, grammar-note rendering |
| App state | `src/app/` | Hash router, `AppProvider` (data loaded once, the store, settings, a change counter), `useNow` (the clock for day-based numbers), keyboard shortcuts |
| Components | `src/components/` | Exercise cards (Parse, Make, Table), feedback, the Greek input and on-screen keyboard, error boundary |
| Pages | `src/pages/` | One per route: path, lesson, placement, practice modes, review, progress, notes, settings |

**Data loading.** The three paradigm files are separate chunks, fetched in parallel after the
app code. A loading screen shows meanwhile, and a retry button appears if the fetch fails.

**Persistence.** `lib/storage.ts` wraps localStorage in try/catch. When storage is
unavailable or full, the session continues in memory and the Progress page says so. Every
answer appends to the attempt log (capped at 5,000) and updates two FSRS cards: one for the
word and form, one for the class and form. Export and import write and read the whole store
as one validated JSON file.

**Answer checking.** `check.ts` compares an answer with every valid form for the prompt, under
the chosen strictness. It names the kind of slip (accent, breathing, ending, stem, augment) and
marks the differing part. The rules are in SPEC §6.

**Security.** The built page has a strict Content-Security-Policy: same-origin only, nothing
inline. It is added at build time in `vite.config.ts`. There are no third-party requests.

## Tests

| Suite | Command | Covers |
|---|---|---|
| pytest + ruff | `cd pipeline && pytest && ruff check .` | the pipeline and the data |
| Vitest + oxlint | `cd app && npm run coverage && npm run lint` | lib, components and pages (jsdom) |
| Playwright | `cd app && npm run e2e` | the built site on desktop and phone: a round of every mode, reloads, a throwing localStorage, axe accessibility checks in both themes, a clean console under the CSP |

`scripts/check.sh` runs all of them. CI runs it on every push and pull request, then
deploys `main` to GitHub Pages.

## Performance (measured 2026-10-20)

Production build, served locally, Lighthouse 12.8 with Chromium:

| | Performance | Accessibility | Best practices | SEO | FCP | LCP | TBT | CLS |
|---|---|---|---|---|---|---|---|---|
| Mobile (emulated slow 4G) | 95 | 100 | 100 | 91 | 1.7 s | 2.6 s | 100 ms | 0.05 |
| Desktop | 100 | 100 | 100 | 91 | 0.5 s | 0.7 s | 0 ms | 0.01 |

The SEO deduction comes from the missing `robots.txt` at the local server's root. On GitHub
Pages a project site lives under `/attic-greek-game/` and cannot provide one.

Transfer sizes (gzip):

| Asset | Size |
|---|---|
| App code + React + ts-fsrs | 128 KB |
| CSS | 9 KB |
| Data: verbs / adjectives / nouns | 45 / 19 / 15 KB, fetched in parallel after the app code |
| Fonts (Gentium Plus, Nunito) | Only the subsets a page uses (Greek, Latin) |

React makes up most of the main bundle. Splitting routes would save little at these numbers.
