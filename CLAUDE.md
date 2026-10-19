# Attic Greek Morphology Game

A static web game for drilling Attic Greek noun, adjective and verb morphology.
The full roadmap is in `docs/PLAN.md`; current status is in `docs/PROGRESS.md`.
**Read both at the start of every session**, then continue from the first unchecked item.

## Non-negotiable rules

1. **Never write Greek forms from memory.** Every form in the app, tests or grammar notes comes
   from `data/paradigms/*.json` or `data/golden/*.json`. If something is missing or looks wrong,
   record it in `data/paradigms/REPORT.md` and exclude the lemma via `data/exclude.txt`.
   Never hand-edit a generated form.
2. **Unicode.** Greek is stored NFC-normalized with full diacritics. All comparisons go through
   `app/src/lib/normalize.ts` (app) or `pipeline/normalize.py` (pipeline). Never use raw `===`
   on Greek strings.
3. **Attic only.** Drop forms Wiktionary labels Epic, Ionic, Doric, Koine, etc.
4. **Test first.** Write a failing test, then the code. Tests must pass before every commit.
5. **Golden tests use only files with `"verified": true`.** Only the user sets that flag.
6. **Stop at every 🧑 HUMAN GATE in PLAN.md.** Say exactly what you need, then wait.
7. **No accounts, no repo settings, no publishing** without the user's explicit go-ahead.

## Workflow

- For each phase: `/superpowers:write-plan` → save to `docs/plans/phase-N.md` → user skims it →
  `/superpowers:execute-plan`.
- After any change to `data/`, `pipeline/`, `app/src/lib/check.ts` or `data/grammar/`,
  run the **greek-checker** subagent and address its findings.
- Commit after each task: `feat:`, `fix:`, `data:`, `test:`, `docs:`.
- Update `docs/PROGRESS.md` at the end of each task (done / next / open questions).

## Commands

- All tests: `bash scripts/check.sh`
- Pipeline: `cd pipeline && source .venv/bin/activate && pytest`
- App: `cd app && npm test` · dev server `npm run dev` · build `npm run build`

## Conventions

- TypeScript strict mode; no `any`.
- The feature schema in `app/src/lib/features.ts` is the single source of truth; the pipeline
  emits JSON that matches it (keep `pipeline/schema.json` in sync).
- Feature values are English keys (`nom`, `gen`, `aor`, `mid`, `3`, `pl`); display labels are
  separate.
- Grammar notes are original prose citing Smyth section numbers. Do not copy textbook text.
