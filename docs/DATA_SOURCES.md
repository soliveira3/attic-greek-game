# Data sources and licenses

| Source | Used for | License | Attribution |
|---|---|---|---|
| English Wiktionary, via kaikki.org (wiktextract) | All inflected forms; glosses of the extra model lemmas | CC BY-SA 4.0 (Wiktionary text) | "Inflection data from Wiktionary (CC BY-SA), extracted by kaikki.org / wiktextract (Tatu Ylonen)." Link https://kaikki.org. The derived JSON in `data/paradigms/` and `data/golden/` is also CC BY-SA 4.0. |
| DCC Greek Core Vocabulary (C. Francese, Dickinson College Commentaries, 2014) | Choosing and ordering lemmas; glosses | CC BY-SA (DCC terms of use, https://dcc.dickinson.edu/terms-use) | Francese, Christopher. *Greek Core Vocabulary*. Dickinson College Commentaries (2014). https://dcc.dickinson.edu/greek-core-list |
| Morpheus (Perseus Project), via libmorpheus | Cross-checking only; **not shipped** | libmorpheus: AGPL-3.0-or-later; stem data: see the libmorpheus runtime-data guide (redistribution not granted, so it stays in the git-ignored `pipeline/raw/`) | — |
| Smyth, *Greek Grammar* (1920) | Human verification of the golden paradigms; section citations in grammar notes | Public domain | Cite section numbers |

## Versions used

| Item | Value |
|---|---|
| kaikki Ancient Greek JSONL | extracted 2026-10-03 from the enwiktionary dump of 2026-09-02; downloaded 2026-10-19 |
| kaikki file SHA-256 | `69d7185819de51cc746d96f8033eb6c3f3e2016a314c2ee640ec09ce80623029` |
| DCC core list page | retrieved 2026-10-19 (524 rows); saved as `pipeline/raw/dcc-greek-core.html`, SHA-256 `88e46cf7d2332c5d56a16258bfdb8c7215b1d1078f418d382018a26eb5ddb440` |
| libmorpheus native runtime | v0.3.2, `libmorpheus-0.3.2-Linux-x86_64-glibc.tar.gz` (checksum verified by `pipeline/fetch_morpheus.sh`) |
| Morpheus stemlib | Perseids (`perseids-tools`) stemlib from libmorpheus tag v0.3.2, commit `dc3d3a83bd67506bb9f43a0f8e7faa9217b0ea0e` |
| libmorpheus Python binding | 0.1.0 (PyPI) |

The same values are recorded in machine-readable form in `pipeline/sources.json`.

## Reproducing the data

```bash
cd pipeline && source .venv/bin/activate
curl -o raw/kaikki-grc.jsonl "https://kaikki.org/dictionary/Ancient%20Greek/kaikki.org-dictionary-AncientGreek.jsonl"
python core_list.py           # data/core_list.csv (fetches the DCC page if raw/ lacks it)
python build_paradigms.py     # data/paradigms/*.json + REPORT.md
bash fetch_morpheus.sh        # optional: native Morpheus for the cross-check
python crosscheck_morpheus.py # adds the Morpheus section to REPORT.md
python make_golden.py         # data/golden/*.json (never overwrites a verified file) + REVIEW.md
```
