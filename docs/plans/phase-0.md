# Phase 0 — Scaffold: implementation plan

Goal: an empty but fully wired project where `bash scripts/check.sh` runs both test suites.

Note: the Superpowers plugin is not installed in this environment, so this plan was written by
hand in the same shape (`write-plan` → tasks with a test step → commit).

## Tasks

1. **Git + ignore file**
   - `git init -b main`
   - `.gitignore`: `node_modules/`, `pipeline/raw/`, `.venv/`, `dist/`, coverage, caches,
     Playwright output.

2. **App scaffold** (`app/`)
   - `npm create vite@latest app -- --template react-ts`
   - Add dev deps: `vitest`, `@vitest/coverage-v8`, `jsdom`, `@testing-library/react`,
     `@testing-library/jest-dom`, `@testing-library/user-event`.
   - `vite.config.ts`: `test: { environment: 'jsdom', setupFiles: ['src/test/setup.ts'] }`.
   - `package.json` scripts: `"test": "vitest"` (check.sh calls `npm test -- --run`).
   - Test first: `src/App.test.tsx` renders `<App/>` and expects the game title heading.
     Watch it fail against the Vite template, then replace the template `App` with a minimal shell.
   - `tsconfig` stays strict (Vite template default); `tsc --noEmit -p .` must pass.

3. **Pipeline scaffold** (`pipeline/`)
   - `python3 -m venv .venv`; `requirements.txt`: `pytest`, `libmorpheus`.
   - `pipeline/tests/test_smoke.py`: a trivial test that imports the (empty) `pipeline` package
     so pytest has something to collect.
   - `pytest.ini` / `pyproject.toml` with `testpaths = tests`.

4. **check.sh**
   - Confirm it runs both suites and exits non-zero when a test fails (temporarily break a test,
     check exit code 1, restore).

5. **Docs**
   - `docs/PROGRESS.md` and `docs/DATA_SOURCES.md` already exist; update PROGRESS.

## Acceptance
- [ ] `bash scripts/check.sh` passes on the empty project
- [ ] First commit made
