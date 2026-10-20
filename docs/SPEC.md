# Attic Greek Morphology Game — v1 Specification

Status: **approved by the user on 2026-10-19** (Phase 1 human gate passed).

Decisions taken with the user on 2026-10-19: grammar scope = plan default; default answer
checking = *ignore accents*; "done" = the plan as written, deployed; vocabulary = every in-scope
DCC core lemma whose data passes the checks.

---

## 1. Purpose and audience

A free, static web game for students who have started Attic Greek and need to drill noun,
adjective and verb morphology until it is automatic. It runs entirely in the browser, needs no
account, and never shows a form that does not come from checked source data.

## 2. Grammar scope (v1)

### Nominals
| Group | Classes in v1 |
|---|---|
| Article | ὁ ἡ τό |
| 1st declension | long-α feminines, η feminines, short-α feminines, masculines in -ης and -ας |
| 2nd declension | masculine/feminine -ος, neuter -ον |
| 3rd declension | consonant stems (labial, velar, dental, liquid/nasal, ντ-stems); σ-stems; ι-stems; υ-stems; ευ-stems |
| Adjectives | 2-1-2 (-ος -η -ον and -ος -α -ον), 2-2 (compound -ος -ον), 3rd declension (-ης -ες, -ων -ον) |

Cases: nominative, genitive, dative, accusative, vocative. Numbers: singular, plural, **dual**.
The dual is kept in the data but **left out of drills by default** (setting: *Include dual*, off).

Not in v1: irregular adjectives (μέγας, πολύς), 3-1-3 adjectives (πᾶς, ταχύς), comparatives,
pronouns other than the article, contracted 2nd declension (νοῦς), Attic declension (νεώς).

### Verbs
Thematic ω-verbs, including consonant stems and verbs with irregular principal parts, provided the
source data is complete and Attic.

| Feature | v1 values |
|---|---|
| Tense | present, imperfect, future, aorist (1st and 2nd), perfect |
| Voice | active, middle, passive |
| Mood | indicative, infinitive |
| Person / number | 1st, 2nd, 3rd × singular, plural (dual as for nouns: stored, off by default) |

- Where middle and passive share forms (present, imperfect, perfect), one form is both middle and
  passive; *Parse it* accepts either, and *Make it* asks for "middle/passive".
- Deponents and other verbs with gaps are drilled only in the voices the data attests.
- Stretch goals for v1 if time allows: contract verbs (-άω -έω -όω) and εἰμί. Otherwise v2.
- Not in v1: pluperfect, future perfect, subjunctive, optative, imperative, participles, μι-verbs.

## 3. Data

- **Forms** come only from English Wiktionary, via the kaikki.org Ancient Greek JSONL dump, built
  by `pipeline/build_paradigms.py` and cross-checked against Morpheus. No form is ever typed by
  hand, in the app, the tests or the grammar notes.
- **Lemma pool:** every lemma on the DCC Greek Core list whose class is in scope, whose paradigm
  is complete enough to drill, and that is not in `data/exclude.txt`. Lemmas are ordered by DCC
  frequency rank. Glosses come from the DCC list.
- **Attic only.** Forms labelled Epic, Ionic, Doric, Aeolic, Koine, etc. are dropped. Where
  Wiktionary's headword is non-Attic (e.g. θάλασσα), the Attic form (θάλαττα) is used only if
  Wiktionary gives an Attic table; otherwise the lemma is excluded and listed in `REPORT.md`.
- **Alternates.** A cell may have several valid forms (e.g. 2nd sg. middle in -ει and -ῃ). All are
  stored and all are accepted. Forms with movable ν, written `λύουσι(ν)` in the source, are
  expanded into both spellings.
- **Vowel-length marks** (macron, breve) are kept for display when the source has them but are
  never required in an answer.
- **Model paradigms** (the golden set): λόγος, δῶρον, χώρα, τιμή, θάλαττα, πολίτης, φύλαξ, ἀγαθός,
  ἀληθής, λύω, one 2nd aorist verb, and one 3rd-declension noun of each stem type. The user checks
  them against Smyth and sets `"verified": true`; only verified files are used as test oracles.
- Shipped JSON (CC BY-SA, derived from Wiktionary) lives in `data/paradigms/` and is loaded
  lazily by part of speech.

## 4. Feature schema

Defined once in `app/src/lib/features.ts` and mirrored in `pipeline/schema.json`.

- Nominal cell: `{ case, number, gender }` with `case ∈ nom gen dat acc voc`,
  `number ∈ sg du pl`, `gender ∈ m f n`.
- Verb cell: `{ tense, voice, mood, person?, number? }` with `tense ∈ pres impf fut aor perf`,
  `voice ∈ act mid pass` (a shared middle/passive form carries both), `mood ∈ ind inf`;
  infinitives have no person or number.
- Lemmas carry `pos`, `class` (e.g. `decl1-a-long`, `decl2-masc`, `decl3-cons-velar`,
  `adj-212`, `verb-thematic`), `gender` for nouns, `gloss`, `rank`, and for verbs which aorist
  type(s) they have.
- Keys are English; display labels ("gen. pl.", "aorist middle 3rd pl.") are separate.

## 5. Game modes

Every mode records each attempt as `{ itemKey, featureKey, correct, errorKind, ts }`.
`featureKey` names a feature cell within a class (e.g. "1st decl. fem. (η) · gen · pl");
`itemKey` is lemma × feature cell. Every mode is playable with the keyboard alone.

1. **Parse it.** Shows a form with its lemma and gloss. The player picks features from button
   groups (case / number / gender for adjectives and the article; case / number for nouns, whose
   gender is shown; tense / voice / mood / person / number for verbs), with number-key shortcuts.
   Any valid parse is correct (e.g. a neuter form that is both nominative and accusative). The
   answer screen lists every valid parse.
2. **Fill the table.** Shows a lemma's paradigm grid (one tense-voice block for verbs) with some
   cells blank (difficulty: a few / half / all). The player types the blanks, Tab moves between
   cells, Enter checks the table. Each cell is marked separately.
3. **Make it.** Shows a lemma and target features; the player types the form.
4. **Endings sprint.** A 60-second round on endings only for one declension class or one
   tense-voice block. The prompt gives the class, its model lemma and the features; the player
   types the ending. Endings are derived automatically from the verified model paradigm by
   removing the stem the block's cells share (for 3rd-declension consonant stems, the
   nominative/vocative singular and dative plural are left out, since stem and ending fuse there).
   Accents are ignored in the sprint whatever the setting, because accent belongs to the word, not
   the ending. Score = correct answers; the best score per sprint is saved.
5. **Review.** A daily FSRS queue (see §8), presented in *Make it* format.

Wrong answers show the correct form(s), highlight the part that differs, name the kind of error,
and link to the relevant grammar note.

## 6. Answer checking

`check(answer, validForms, strictness)` compares against **all** valid forms for the prompt.

Always applied to both sides: trim, Unicode NFC, lowercase, final σ → ς, remove vowel-length
marks, expand movable-ν alternates.

| Mode | Must match | Ignored |
|---|---|---|
| strict | letters, breathings, iota subscript, accents, diaeresis | length marks |
| **ignore accents** (default) | letters, breathings, iota subscript | accents, diaeresis, length marks |
| lenient | letters only | all diacritics |

In the more forgiving modes the answer still counts as correct, but feedback points out what was
off ("Correct — note the accent: λόγου").

`errorKind`, most specific first: `accent`, `breathing`, `subscript`, `augment`, `ending`,
`stem`, `parse` (Parse it only), `blank`. Ending vs. stem is decided by where the first difference
falls relative to the lemma's stem for that block.

Refinements after the code reviews of 2026-10-19/20 (implemented in `app/src/lib/check.ts`):
- An answer that is exactly **another form of the same word**, among the forms being drilled (the
  dual counts only when it is drilled), is wrong in strict and ignore-accents mode, and the
  feedback names that form. (Otherwise ignore-accents would accept, say, the present for a liquid
  future that differs from it only in its accent.) Lenient mode, which compares letters only,
  accepts it and mentions the other form.
- **Iota written on the line** (ωι for ῳ) is accepted with a note in ignore-accents and lenient;
  strict requires the subscript.
- **Typing aids**: a breathing or accent typed before its vowel moves onto it; marks may be typed
  in any order; spacing accents and breathings, apostrophes used for a breathing, other code points
  for the same marks, compatibility letters, invisible characters and left-over beta-code symbols
  are folded; unknown marks are ignored.
- Every wrong answer lists its **errors**: a letter error (augment, stem or ending) if the letters
  differ, then any breathing, subscript or accent error the mode counts. Differences the mode
  forgives are listed as notes.
- **Augment errors** cover a missing, wrong or misplaced augment, including in compounds (an
  unaugmented compound, or the augment put before the preverb), and the present typed for the
  imperfect or the imperfect for the present (same person, number and voice), except where the
  augment cannot be seen (ἥκω: those count as ending errors). Slips inside a preverb or in the
  ending are stem or ending errors.
- With vowel-length marks shown, *Parse it* treats forms that differ only in a long or short
  vowel as different words (a feminine singular in long α is not a neuter plural in short α);
  with the marks hidden, every parse of the spelling is accepted.
- The *Endings sprint* accepts iota written on the line, as answer checking does outside strict
  mode; its answers are logged for statistics but do not schedule spaced-repetition cards.

## 7. Typing Greek

- **Beta code** in any answer box, converted as you type: TLG letters
  (`a b g d e z h q i k l m n c o p r s t u f x y w`), diacritics after the letter in any order
  (`)` `(` `/` `\` `=` `|` `+`), `s` becomes ς at the end of a word. Example: `lu/w` → λύω.
- **On-screen polytonic keyboard** (letters plus diacritic keys that apply to the previous
  letter), usable by mouse, touch or keyboard.
- Text typed with an OS Greek keyboard is accepted as is.

## 8. Spaced repetition and progress

- `ts-fsrs` cards of two kinds: **feature cells** (class × features, e.g. "aorist middle 3rd pl.")
  and **lemma × cell** items.
- Rating: correct → Good; correct only because of the strictness setting → Hard; wrong → Again.
- A weak feature cell pulls in lemmas of the same class the player has not yet met in that cell.
- Daily new-card limit (default 20). Review draws its queue from FSRS due dates.
- **Stats page:** accuracy heat map laid out as the paradigm grid for each class, day streak, and
  items due today.
- Progress lives in `localStorage` (every access wrapped in try/catch; the app keeps working in
  memory if storage is unavailable) and can be exported and imported as a JSON file.

## 9. Grammar notes

`data/grammar/*.md`: short original notes, citing Smyth section numbers, on each declension
class, the article, adjective types, the augment, tense stems and principal parts, 1st vs. 2nd
aorist, the perfect, middle vs. passive, infinitives, and accent basics (persistent vs. verb
accent). Every feature in scope links to at least one note. Greek examples in notes are drawn
from the paradigm data.

## 10. App shell and settings

- Single-page app with hash routes (works on GitHub Pages): Home, the five modes, Stats,
  Settings, Notes.
- Settings: strictness, scope filters (part of speech, classes, tenses, voices, include dual),
  show vowel-length marks, input method hints.
- Polytonic-capable font (Gentium Plus or Noto Serif), bundled with the site.
- Accessible (labels, focus order, contrast), works on phones, light and dark themes.

## 11. Definition of done for v1

- All five modes, Review, Stats, Settings and Notes work end to end, keyboard only.
- Every golden form passes `check()` in all three modes; ambiguous forms accept every parse.
- `lib/` coverage ≥ 95%; one Playwright smoke test plays a round of each mode.
- REPORT.md reviewed, doubtful lemmas excluded; greek-checker findings addressed.
- User has verified the golden set and approved the grammar notes.
- CI green and the site live on GitHub Pages; README with data sources and licenses.

## 12. Out of scope (v2 backlog)

Contract verbs and εἰμί (if not reached), μι-verbs, participles, subjunctive / optative /
imperative, pluperfect, pronouns, comparatives, irregular and 3-1-3 adjectives, sentence-level
parsing from real texts, accent-placement drills, audio.
