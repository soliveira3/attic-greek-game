# Phase 5 — Spaced repetition and progress: implementation plan

Goal: a daily Review queue scheduled by FSRS, a Stats page, and progress that can be exported and
imported. Pure library code takes the current time as an argument, so scheduling is tested with a
fake clock.

## Architecture

- **`lib/srs.ts`** (ts-fsrs 5.4.2, MIT; fuzz off so intervals are predictable):
  - Two kinds of card (SPEC §8): `f:<featureKey>` (class × cell) and `i:<itemKey>` (lemma × cell).
  - `gradeFor(correct, forgiven)`: right → Good; right only because the strictness setting forgave
    something → Hard; wrong → Again.
  - `review(state, { itemKey, featureKey }, grade, now)` updates both cards (creating them when
    new). Every answer in every mode is evidence, so every mode calls it; only Review counts new
    cards against the daily limit.
  - `weakFeatures(state, now)`: feature cards in relearning or with retrievability below 0.85,
    weakest first.
  - Stored under `srs` in the store, validated on load; dates as ISO strings.
- **`lib/review.ts`**: `reviewQueue(data, settings, srs, now, rng)`:
  1. due item cards in scope, earliest first;
  2. new items, up to the daily limit minus the new cards Review introduced today: first lemmas
     of the same class as a weak feature cell that have not met that cell, then unseen cells of
     the most frequent lemmas in scope (DCC rank), one cell per lemma.
  A wrong answer brings the item back once at the end of the session.
- **`lib/progress.ts`**: `answer(store, attempt, grade, now, { introduced })` records the attempt
  and updates the cards; `exportProgress(store)` / `importProgress(store, json)` (validated; every
  key replaced; unknown or malformed files refused with a reason).
- **`lib/stats.ts`**: day streak (local days, counting back from today or yesterday), accuracy per
  feature key, items due today, and heat-map layouts: a nominal class laid out like its first
  lemma's table; verbs as person/number rows × tense-voice columns.
- **Settings**: `newPerDay` (default 20, 0–200).
- **Pages**: `#/review` (Make it format, counts of due and new left, "done for today" with the next
  due time), `#/stats` (streak, due today, accuracy heat maps with numbers as text, export and
  import). Home shows how many reviews are due.

## Tasks

1. srs.ts with fake-clock tests (scheduling, grades, weak features, storage round trip)
2. review.ts queue + `newPerDay` setting; all modes call `answer()` (progress.ts)
3. Review page
4. stats.ts + Stats page (heat maps, streak, due)
5. Export / import
6. Smoke test extended to Review and Stats; reload keeps progress; storage that throws still works

## Acceptance
- [ ] FSRS scheduling unit-tested with a fake clock
- [ ] Progress survives reload; the app still works if localStorage throws
