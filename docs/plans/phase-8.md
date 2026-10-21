# Phase 8 — Professional audit: implementation plan

Requested by the user on 2026-10-20 ("draft up the plan and then complete it"), so the plan is
carried out straight after it is written; the user skims it at the gate at the end. Work happens on
the branch `phase-8-audit`; nothing is pushed or published.

Goal: before v1 goes public, bring the repository and the site up to the standard of a well-run
open-source project: CI that explains its own failures, a clean lint, reviewed code, the documents
a contributor or teacher expects, and a kit for the human reviews no tool replaces.

Findings that started this phase:
- The repository exists (`soliveira3/attic-greek-game`, private) and `main` was pushed up to
  `c5975d0`, but CI **failed**: `scripts/check.sh` reported "pipeline (pytest)" and then printed
  only the last 60 lines of the combined log, which were Playwright's. The pytest failure does not
  reproduce locally (fresh clone, shallow clone from GitHub, Python 3.14.6 and 3.14.8, empty HOME,
  container), so the cause can only be read from the next CI run.
- CI warns that `actions/checkout@v4`, `setup-node@v4` and `setup-python@v5` run on the deprecated
  Node 20.
- oxlint reports 7 warnings; lint is not part of `check.sh` or CI.
- Pages is not enabled. On a free plan, Pages needs a public repository.

## Tasks
1. **CI that explains itself.** `check.sh` prints the output of each failing suite under its own
   heading (not the tail of one shared log); Python requirements pinned to exact versions; GitHub
   Actions moved to their current majors (Node 24); the Playwright report uploaded when the
   browser tests fail. Verified by forcing a failure in each suite.
2. **Lint clean.** Fix the oxlint warnings; `npm run lint` fails on warnings and runs in
   `check.sh` (and so in CI). Python: `ruff check` with its default rules, also in `check.sh`.
3. **Code review.** A careful review of `app/src` and `pipeline/` for correctness bugs. Every
   confirmed finding fixed test-first; the greek-checker runs if `data/`, `pipeline/`, `check.ts`
   or `data/grammar/` change.
4. **Site metadata and hardening.** Page description, theme colour, a no-script message, a
   Content-Security-Policy, and the version shown in the footer (`package.json` → 1.0.0). An e2e
   test fails on any console error or CSP violation on every page.
5. **Repository documents.** `CONTRIBUTING.md` (setup, the data rules in plain words, how to
   report a wrong form, tests and commit style), `CHANGELOG.md` (1.0.0), `SECURITY.md`,
   `docs/ARCHITECTURE.md` (pipeline → data → lib → pages), issue templates (wrong form, bug,
   idea), a pull-request template, `.editorconfig`, `.nvmrc`, Dependabot config (npm, pip,
   Actions; monthly, grouped).
6. **README.** Screenshots (light, dark, phone) taken by a script from the built site, CI badge,
   the live-site address, a short "how it works" and links to the new documents.
7. **Performance.** Measure the built site (bundle sizes, Lighthouse with Playwright's Chromium if
   it runs) and fix cheap wins; record the numbers in `docs/ARCHITECTURE.md`.
8. **Human review kit.** `docs/REVIEW_GUIDE.md`: what a Greek teacher should check, with a
   reproducible random sample of forms drawn from the data (`pipeline/review_sample.py`, tested),
   and a 20-minute play-test script for learners. Reports go through the "wrong form" issue
   template.
9. **Close.** `docs/PROGRESS.md` and `docs/PLAN.md` updated; full `check.sh` green.
10. 🧑 **HUMAN GATE** (merged with the Phase 7 gate): see "What the user does" below.

## What the user does (gate)
1. Skim this plan and the branch; say whether to merge `phase-8-audit` into `main`.
2. Make the repository public (Settings → General → Danger zone), or keep it private on a paid
   plan, then enable Pages with "GitHub Actions" as the source (Settings → Pages).
3. Give Claude the go-ahead to push. Claude then watches CI, fixes the pytest failure the new
   output reveals, and checks the live site.
4. Optional, once public: CodeQL default setup and private vulnerability reporting
   (Settings → Code security), and a branch rule on `main` requiring the `check` job.
5. Optional: send `docs/REVIEW_GUIDE.md` to a Greek teacher and two or three learners.

## Acceptance
- [ ] A failing suite's own output appears in the CI log (checked locally by forcing failures)
- [ ] `check.sh` runs lint (oxlint with no warnings, ruff) and passes
- [ ] Code review done; confirmed findings fixed with tests
- [ ] No console errors or CSP violations on any page (e2e)
- [ ] CONTRIBUTING, CHANGELOG, SECURITY, ARCHITECTURE, REVIEW_GUIDE, templates, Dependabot written
- [ ] README has screenshots, badge, live address
- [ ] Performance measured and recorded
- [ ] 🧑 User gate passed (merge, public repo, Pages, push)
