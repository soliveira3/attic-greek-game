# Progress

| Phase | Status |
|---|---|
| 0 — Scaffold | done |
| 1 — Spec 🧑 | in progress |
| 2 — Data pipeline 🧑 | not started |
| 3 — Core library | not started |
| 4 — Game modes | not started |
| 5 — Spaced repetition & progress | not started |
| 6 — Grammar notes 🧑 | not started |
| 7 — Polish & ship 🧑 | not started |

## Current task
Phase 1 — draft docs/SPEC.md and get it approved.

## Waiting on the user
(nothing yet)

## Open questions
- The Superpowers plugin is not installed, so phase plans in docs/plans/ are written by hand in
  the same shape. Install it with `/plugin install superpowers@claude-plugins-official` if you
  want the real skills used.

## Environment notes
- Node 22, Vite 8, React 19, TypeScript 7 (`tsc -b`), Vitest 5.
- Python 3.14 venv in pipeline/.venv; libmorpheus 0.1.0 installed from PyPI.
- `scripts/check.sh` type-checks with `tsc -b` (the template's root tsconfig has `files: []`,
  so `tsc --noEmit -p .` checked nothing).

## Known data issues
(see data/paradigms/REPORT.md once Phase 2 runs)

## Log
<!-- newest first: YYYY-MM-DD — what was done -->
- 2026-10-19 — Phase 0: git repo, Vite React-TS app with Vitest + RTL, pipeline venv with pytest
  and libmorpheus, check.sh runs both suites (verified it exits 1 on a failing test).
