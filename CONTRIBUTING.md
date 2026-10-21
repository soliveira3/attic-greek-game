# Contributing

Thank you for helping. The most useful contribution is a report of a form that looks wrong:
learners trust what a drill tells them, so one bad form matters more than a missing feature.

## Reporting a wrong form

Open an issue with the **Wrong or doubtful form** template. Include the form as the game showed
it, the word, what was asked (for example "aorist middle 3rd plural"), what you expected, and
where your form comes from (a Smyth section, a textbook page). A screenshot helps.

Forms are never corrected by hand. A wrong form is fixed at its source (Wiktionary), or the word
or tense is left out through `data/exclude.txt` with a comment saying why. See "The data rules"
below.

## Setting up

Requirements: Node 22 (see `.nvmrc`) and Python 3.11 or newer.

```bash
python -m venv pipeline/.venv && pipeline/.venv/bin/pip install -r pipeline/requirements.txt
cd app && npm ci && npx playwright install chromium
npm run dev               # http://localhost:5173
```

`bash scripts/check.sh` runs everything CI runs: ruff and pytest for the pipeline; oxlint, Vitest
with coverage, the type check and the Playwright browser tests for the app. `SKIP_E2E=1` skips the
browser tests. A failing suite's output is printed under its name.

Outside CI, Playwright reuses a preview server already listening on port 4173, and that server
shows whatever is in `app/dist`. Run `npm run build` first if one is running.

## The data rules

These come from [CLAUDE.md](CLAUDE.md), which governs all work on the project, human or AI:

1. **No Greek form is typed by hand.** Every form in the app, the tests and the grammar notes
   comes from `data/paradigms/*.json` or `data/golden/*.json`, which the pipeline builds from
   Wiktionary (via kaikki.org) and checks against Morpheus. Grammar notes pull their forms from
   the data with placeholders (`{{form …}}`, `{{table …}}`).
2. **Unicode.** Greek is stored NFC with full diacritics. Compare Greek strings only through
   `app/src/lib/normalize.ts` or `pipeline/normalize.py`, never with `===`.
3. **Attic only.** Forms Wiktionary labels Epic, Ionic, Doric, Koine and so on are dropped.
4. **Golden tests use verified files only.** `"verified": true` in `data/golden/` is set by the
   maintainer after checking the table against Smyth.

Rebuilding the data from the sources is described in [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md).

## Changing code

- Write a failing test first, then the code. `check.sh` must pass before every commit.
- TypeScript is strict; no `any`. Feature values are English keys (`gen`, `aor`, `mid`); labels
  for display live in `app/src/lib/features.ts`, the single source of truth for the schema
  (keep `pipeline/schema.json` in sync).
- Grammar notes are original prose citing Smyth by section number. Do not copy textbook text.
- Commit messages start with `feat:`, `fix:`, `data:`, `test:` or `docs:`.
- Keep pull requests small and say in the description how you tested the change.

How the parts fit together: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Conduct

Be kind and assume good faith. Disagreements about Greek are settled by sources, not by
seniority: cite the grammar, the text or the dictionary.

## Licenses

By contributing you agree that your code and notes are released under the MIT license
([LICENSE](LICENSE)) and data changes under CC BY-SA 4.0 ([data/LICENSE](data/LICENSE)).
