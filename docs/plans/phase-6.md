# Phase 6 — Grammar notes: implementation plan

Goal: one short original note per topic in `lib/notes.ts` (`NOTE_TOPICS`), in `data/grammar/<topic>.md`,
citing Smyth by section number; every feature in scope links to a note (`topicFor`); the user approves
them (🧑 gate).

## Format (`lib/grammar.ts`)

Notes are Markdown with a small set of features (title line, `##` headings, paragraphs, `-` lists,
`**bold**`, `*italic*`, `[text](topic)` links to other notes) and placeholders that pull Greek from
the paradigm data when the note is shown, so no Greek form is typed in a note:

- `{{form REF CELL…}}` inline forms, `{{word REF}}` a headword;
- `{{table REF}}` a nominal paradigm, `{{table REF BLOCK}}` one tense-voice block of a verb (the
  ending is set off where the word is a verified model with a sprint set);
- `{{parts REF…}}` a table of principal parts.

`noteProblems()` (unit-tested on every note) refuses: a title that is not the topic's, no `Smyth §N`
citation, a placeholder or link that does not resolve, or Greek typed in the prose (more than two
letters in a row; single letters and two-letter endings such as -ος are allowed in prose).

Smyth section numbers were checked against the Perseus text of Smyth (1920), fetched into the
git-ignored `pipeline/raw/smyth/` cache.

## Tasks
1. `lib/grammar.ts` (parser, validator) with tests
2. Notes page: index of notes, each note rendered with its tables and forms; links from feedback
3. The 18 notes
4. greek-checker review of the notes; findings addressed
5. 🧑 HUMAN GATE: the user approves the notes

## Acceptance
- [x] Every feature in scope links to a note (tested in app/src/lib/grammar.test.ts)
- [x] User approved the notes (2026-10-20)
