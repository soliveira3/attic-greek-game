# Redesign: a guided path and a game-like look (after v1, before publishing)

Requested by the user on 2026-10-20: "research the front-end design and flow of an app such as
Duolingo and redesign this one to be fun, engaging and visually professional; consider learning
progression especially, but mostly visuals and making it easy to grow and learn."

## What we take from Duolingo (flow, not branding)
- One obvious next step: the home screen is a winding **path** of lesson nodes, one highlighted
  "Start" node, units with a header and a guidebook (our grammar notes).
- Short, finite **lessons** (8–12 exercises) in a focused screen: close button, progress bar,
  one exercise at a time, a big Check button at the bottom, a coloured feedback sheet that slides
  up (green right / red wrong) with Continue. Missed items come back at the end of the lesson.
- **Reward loop**: XP per right answer and per lesson, a daily XP goal with a ring, the day
  streak, "3 in a row" combos, a lesson-complete screen with XP / accuracy / time, sound effects
  (can be switched off).
- **Chunky tactile UI**: rounded type, thick 3D buttons that press in, big tap targets, bright
  colours on white; a mascot for empty and celebration states.
- Not taken: hearts (punishing mistakes works against drilling), leagues, gems, Duolingo's owl,
  colours or font. Our mascot is an original drawing of Athena's little owl, the emblem on Attic
  coins; finished lesson nodes become gold coins.

## Learning progression
Units follow a common textbook order, each scoped by the existing settings scope (classes or
tense × voice), built only from classes and blocks present in the data:
article → 2nd decl. → 1st decl. feminines → present active → adjectives -ος -η/-α -ον and
two-ending → 1st decl. masculines → imperfect active → present and imperfect middle/passive →
future → 3rd decl. consonant stems → aorist active → aorist middle → 3rd decl. σ-stems →
3rd decl. adjectives → ι-, υ-, ευ-stems → aorist and future passive → perfect.

Five lessons per unit: Spot the form (parse) · Build the form (make) · Mixed · Full table ·
Unit test (≥ 80 % to pass). Early lessons use the unit's most frequent words only; the pool
grows lesson by lesson. Lessons unlock in order; a locked unit can be reached by passing its unit
test ("Jump here"). Every answer still feeds the attempt log and the FSRS cards, so Review and
Progress keep working; the free modes stay under Practice.

## Tasks (test first)
1. lib/path.ts: units, lessons, unlock rules, lesson builder, path log, XP and daily goal.
2. Settings: daily goal, sound effects; progress export/import includes the path log.
3. Components: icons, owl, ParseCard and TableCard extracted from the pages, sounds.
4. Shell: sidebar (desktop) / bottom tabs (phone), stats bar, right rail.
5. Pages: Learn (path), Lesson, Practice; restyle every other page.
6. New stylesheet (tokens, light and dark), screenshots on desktop and phone, axe and smoke
   tests updated, PROGRESS.md.

## Follow-up (2026-10-20): free navigation, a recommended start, pointers for frequent misses
Requested by the user: "make the units easily enterable and exitable for anyone so they can go at
their own pace; keep all units unlocked; a recommended start a little below their actual level;
reference lessons when they miss something often."

1. Every lesson of every unit is open. A lesson is done when it was finished (a unit test only at
   80 %); a passed unit test marks the whole unit done. A unit index on the path jumps to any unit,
   and leaving a lesson returns to its unit on the path.
2. Level: the highest unit that is solid, from a passed unit test, a placement check, or at least
   12 recent answers in that unit at 85 % or better. The recommendation sits a little below it:
   the Mixed practice lesson of the highest solid unit as a warm-up, then the first unfinished
   lesson after it. With no history: unit 1, with an offer to take the placement check.
3. Placement check ("Find my level", retakeable): two exercises per unit in path order, stopping
   after two units with a miss; the level is the highest unit answered fully right.
4. Frequent misses: a form (class × cell) missed at least 3 times in the last 30 days and right
   less than 70 % of the time is a weak spot. Weak spots are listed on the path and on Progress
   with the lesson to revisit (Spot the form for parsing misses, Build the form otherwise) and the
   grammar note; the feedback after a wrong answer says so when the form is a weak spot.
