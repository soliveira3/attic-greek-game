# Changelog

All notable changes to this project are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow
[Semantic Versioning](https://semver.org/).

## [1.0.0] — 2026-10-21

The first public version.

### Drills
- A guided path of 17 units in textbook order, five lessons each, with a placement check, a
  recommended start and unit tests.
- Practice modes: Parse it, Fill the table, Make it, a 60-second Endings sprint.
- Review: a daily spaced-repetition queue (FSRS) built from the forms and features missed.
- Feedback on every wrong answer: the right form with the differing part highlighted, what kind of
  slip it was (accent, ending, stem, augment) and a link to the grammar note.
- Three answer-checking modes: strict, ignore accents (the default) and lenient.
- Beta-code typing (`lu/w` gives λύω), a Greek keyboard or the on-screen keyboard.

### Content
- The article; 1st, 2nd and 3rd declension nouns; adjectives of two and three endings; thematic
  ω-verbs in the present, imperfect, future, aorist and perfect, all voices, indicative and
  infinitive. 282 words from the DCC Greek Core list.
- Every form from English Wiktionary (via kaikki.org), cross-checked against Morpheus; the model
  paradigms compared with Smyth.
- 18 grammar notes citing Smyth.

### Progress and privacy
- Progress, XP, daily goal and streak stored only in the browser; export and import as JSON.

### Quality
- Unit, component and browser tests, including accessibility checks (axe) on every page in both
  themes, a clean console under a strict Content-Security-Policy, and CI on every push.

[1.0.0]: https://github.com/soliveira3/attic-greek-game/releases/tag/v1.0.0
