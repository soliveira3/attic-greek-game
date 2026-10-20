# Phase 4 — Game modes: implementation plan

Goal: the four practice modes playable end to end with the keyboard alone, every attempt
recorded, wrong answers explained. Built test-first with React Testing Library; one Playwright
smoke test plays a round of each mode.

## Architecture

- **Routing**: a small hash router (`#/`, `#/parse`, `#/fill`, `#/make`, `#/sprint`,
  `#/settings`, `#/notes/<topic>`; `#/review` and `#/stats` arrive in Phase 5). Works on
  GitHub Pages without server rewrites.
- **Data**: `loadParadigms()` once at start-up behind a `DataProvider`; a loading and an error
  state.
- **Settings** (`lib/settings.ts` + context): strictness (default ignore-accents), scope (parts
  of speech, classes, tenses, voices, include dual), show length marks. Persisted through
  `lib/storage.ts`, a `localStorage` wrapper where every access is in try/catch and falls back
  to memory.
- **Attempts** (`lib/attempts.ts`): `{ itemKey, featureKey, correct, errorKind, ts }` appended
  to the progress store (Phase 5 builds spaced repetition on it). `itemKey` = lemma ref + cell
  key; `featureKey` = class + cell key (features.ts).
- **Prompts** (`lib/prompts.ts`): pure, seedable generators — `pickCell(data, scope, rng)`,
  `parsePrompt`, `makePrompt`, `tablePrompt` (one lemma; one tense-voice block for verbs;
  blanks by difficulty), with `stemLength` and `pastTense` passed on to `checkAnswer`.
- **Endings** (`lib/endings.ts`): endings of each class derived from its verified golden model
  (`data/golden/*.json`): per block, the letters after the stem all forms share; 3rd-declension
  consonant stems leave out nominative/vocative singular and dative plural; cells with an empty
  ending are skipped. Nothing is typed by hand.
- **Grammar links** (`lib/notes.ts`): `topicFor(class, cell, errorKind)` → note id; the notes
  page shows "coming in Phase 6" until the notes exist.

## Components

- `GreekInput`: text box that converts beta code as you type (betacode.ts), with a hint line.
- `GreekKeyboard`: on-screen letters and diacritic keys (apply to the previous letter), usable
  by mouse, touch and keyboard (buttons in tab order).
- `Feedback`: correct / incorrect, the valid form(s) with the differing part highlighted
  (`check.diff`), the error kind in plain words, forgiven differences (`notes`), a link to the
  grammar note, and "Next" (Enter).
- Mode screens: `ParseIt` (button groups per feature with number-key shortcuts, all valid parses
  shown after answering), `FillTable` (grid with blanks, Tab between cells, Enter checks),
  `MakeIt`, `EndingsSprint` (60 s, score, best score saved).
- `Home`, `Settings`, `NotesPage`.

## Tasks (each: failing component test → code → green → commit)

1. storage, settings, attempts (lib, unit tests)
2. prompts and endings (lib, unit tests on the real data)
3. App shell: router, DataProvider, Home, Settings, GreekInput, GreekKeyboard
4. Feedback component
5. Parse it
6. Fill the table
7. Make it
8. Endings sprint
9. Playwright smoke test (one round of each mode)
10. greek-checker on the endings derivation and on what the modes show

## Acceptance
- [x] Each mode is playable end-to-end with keyboard only (app/e2e/smoke.spec.ts)
- [x] Wrong answers show the correct form, highlight the differing part, and link to the grammar note
- [x] Playwright smoke test plays one round of each mode
