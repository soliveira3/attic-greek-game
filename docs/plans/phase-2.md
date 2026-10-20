# Phase 2 — Data pipeline: implementation plan

Goal: `data/paradigms/{nouns,adjectives,verbs}.json` built only from the kaikki.org Wiktionary
dump, cross-checked against Morpheus, with a REPORT.md of every doubtful item and a golden set
waiting for the user's verification.

## Inputs (all fetched from the sandbox; nothing to attach)

| Input | Where | Notes |
|---|---|---|
| DCC Greek Core list | `pipeline/raw/dcc-greek-core.html` → `data/core_list.csv` | 524 rows, CC BY-SA |
| kaikki Ancient Greek JSONL | `pipeline/raw/kaikki-grc.jsonl` | 404 MB, extracted 2026-10-03 from enwiktionary 2026-09-02 |
| Morpheus | `pipeline/raw/morpheus/` | native libmorpheus v0.3.2 (Linux x86-64) + Perseids stemlib from tag v0.3.2; fetched by `pipeline/fetch_morpheus.sh` |

`pipeline/raw/` is git-ignored, so tests that need it skip when it is absent (CI).

## What the survey of the dump showed

- Forms come in tables; each table starts with a `table-tags` row whose text carries the
  dialect ("Attic declension-2", "Epic aorist", "present", "Attic future", "contracted present").
- Keep a table if its label has the word *Attic* or no dialect word at all. If a tense has both an
  "Attic X" and a plain "X" table (μάχομαι, βάλλω futures; βούλομαι imperfect), use only the Attic
  one: the plain table is the non-Attic paradigm there.
- Labels with other modifiers (pluperfect, future perfect, iterative, intransitive, poetic) are
  out of scope and skipped.
- Shared middle/passive forms are tagged `middle` + `passive`; this becomes voice group `mp`.
- Forms carry vowel-length marks (ᾰ ᾱ ῐ ῑ ῠ ῡ, sometimes as combining U+0304/U+0306). They are kept.
- Common-gender nouns show the article inside the form ("ἡ φῠ́λᾰξ"). The article token is stripped
  when it is a form of the article paradigm in the same dump (not a hand-made list).
- Movable ν appears as two separate forms (λείπουσῐ / λείπουσῐν); both are kept as alternates.
- Some cells are mis-tagged in the source (e.g. a perfect "3rd pl." that is a 3rd sg.). Morpheus
  catches these; they are reported, not fixed.
- Some DCC headwords are non-Attic (θάλασσα, γλῶσσα, πράσσω, τάσσω, φυλάσσω, ἐλάσσων, κρείσσων,
  ἥσσων). If the dump has a same-POS entry tagged "Attic form of <headword>" whose spelling is the
  headword with σσ → ττ, that entry is used instead (θάλαττα, γλῶττα, …), and recorded in REPORT.
- Model lemmas not on the DCC list (δῶρον, πολίτης, φύλαξ, νεανίας, ἄστυ) come from
  `data/extra_lemmas.csv`; their gloss is the first Wiktionary gloss.

## Data model (shared with `app/src/lib/features.ts`, mirrored in `pipeline/schema.json`)

```jsonc
{
  "schemaVersion": 1,
  "source": { "kaikki": "2026-10-03", "wiktionary": "2026-09-02", "dcc": "2026-10-19" },
  "lemmas": [{
    "id": "λόγος",            // NFC headword, unique within a file
    "lemma": "λόγος",
    "dccLemma": "λόγος",      // DCC headword (differs for Attic substitutions); null for extras
    "pos": "noun",            // noun | adj | article | verb
    "class": "decl2-mf",
    "gender": ["m"],          // nouns only
    "gloss": "…", "rank": 45, // rank null for extra lemmas
    "cells": [
      { "key": "gen.sg", "case": "gen", "number": "sg", "forms": ["λόγου"] }
      // adj/article: key "gen.sg.m", plus "gender"
      // verbs: key "aor.mid.ind.3.pl" | "pres.mp.inf"; fields tense, voice (array), mood,
      //        person?, number?
    ]
  }]
}
```

Classes: `article`; nouns `decl1-a-long decl1-a-short decl1-eta decl1-masc-es decl1-masc-as
decl2-mf decl2-n decl3-labial decl3-velar decl3-dental decl3-nt decl3-liquid decl3-s decl3-i
decl3-u decl3-eu`; adjectives `adj-212-eta adj-212-alpha adj-22 adj-3-es adj-3-on`; verbs
`verb-thematic` (contract classes added later if the stretch goal is reached). Verbs also record
`aoristType: ["1"] | ["2"] | []`. Anything else is out of scope and listed in REPORT.

Completeness rule: a noun needs all sg + pl cells (dual optional); an adjective needs every
gender × case × sg/pl; a verb keeps each tense-voice indicative block that has all six sg/pl cells,
plus any infinitive, and needs at least one present block.

## Exclusions — `data/exclude.txt`

One rule per line, `#` comments:
```
λαός                          # whole lemma
λείπω  perf.act               # a tense-voice block (prefix of cell keys)
λείπω  perf.act.ind.3.pl  λέλοιπεν   # one form inside one cell
```
Excluding never edits a form; it only removes data from the output, and REPORT lists what each
rule removed.

## Tasks (each: failing test → code → green → commit)

1. **normalize.py** — `nfc`, `strip_length`, `strip_accents` (keeps breathings, subscript),
   `strip_all`, `final_sigma`, `key()` (NFC + no length marks). Tests on strings taken from the dump.
2. **betacode.py** — Unicode → Morpheus beta code (lowercase, length marks dropped). Round-trip
   tests against Morpheus' own `workword` output for sample forms.
3. **core_list.py** — parse the saved DCC HTML into `data/core_list.csv`
   (`lemma,pos,gloss,rank,dcc_pos,headword`). Fixture: three real rows cut from the page.
4. **schema.json + features.ts** — JSON Schema for paradigm files; `app/src/lib/features.ts`
   with the same enums; a Vitest test asserts the two agree.
5. **build_paradigms.py** — streaming reader, entry selection (DCC + extras, POS match, Attic
   substitution), table grouping and dialect filter, tag → feature mapping, article stripping,
   classification, completeness, exclusions, output + REPORT.md. Unit tests use small synthetic
   entries built from real dump lines (copied verbatim into `tests/fixtures/`).
6. **crosscheck_morpheus.py** — analyze every form; a form passes if some analysis has the same
   lemma (or the DCC lemma) and compatible features. Writes a "Morpheus cross-check" section
   into REPORT.md between markers. Unit tests use fake analyses; an integration test runs only if
   `pipeline/raw/morpheus` exists.
7. **Review REPORT.md**, add rules to `data/exclude.txt`, rebuild. Run the **greek-checker**
   subagent and address its findings.
8. **make_golden.py** — copy the generated tables of the golden lemmas into
   `data/golden/<lemma>.json` with `"verified": false` (never overwriting a verified file), and
   write `data/golden/REVIEW.md` (one grid per lemma) to make checking against Smyth quick.
   Golden lemmas: ὁ, λόγος, δῶρον, χώρα, τιμή, θάλαττα, πολίτης, νεανίας, φύλαξ, σῶμα, γένος,
   πόλις, ἄστυ, βασιλεύς, ἀγαθός, ἄδικος, ἀληθής, σώφρων, λύω, λείπω (2nd aorist).
9. **tests** — every paradigm file validates against schema.json; every verified golden file
   matches the generated data exactly; NFC and character-set checks on all forms.
10. **DATA_SOURCES.md** — versions, dates, checksums, licenses.
11. 🧑 **HUMAN GATE** — user verifies the golden set.

## Acceptance
- [x] pytest: schema validation on all paradigm files; golden files match generated data exactly
- [x] REPORT.md reviewed; doubtful lemmas excluded via `data/exclude.txt`
- [x] greek-checker subagent run, findings addressed (three audits)
- [x] User has verified the golden set (2026-10-19, on the evidence of the Smyth comparison)

## Outcome notes
- Verb tables ended up chosen by DCC principal parts (`pipeline/select_tables.py`), not by
  table order; see its docstring.
- The user does not read Greek, so verification used `pipeline/compare_smyth.py` (Smyth via
  Perseus): 20/24 tables match in every cell, 4 match wherever Smyth could be read, 0 differences.
