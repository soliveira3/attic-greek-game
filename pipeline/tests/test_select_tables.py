"""Headwords below are copied from data/core_list.csv (DCC)."""
import json
import re
import unicodedata
from pathlib import Path

from kaikki import is_greek_form
from normalize import strip_accents
from select_tables import principal_parts


def test_principal_parts_keeps_greek_words_only():
    parts = principal_parts("ἔχω, ἕξω or σχήσω, 2 aor. ἔσχον, ἔσχηκα, impf. εἶχον")
    assert parts == {strip_accents(w) for w in ["ἔχω", "ἕξω", "σχήσω", "ἔσχον", "ἔσχηκα", "εἶχον"]}


def test_principal_parts_skips_hyphenated_compound_stems():
    parts = principal_parts("πίνω, πίομαι, 2 aor. ἔπιον, πέπωκα, -πέπομαι, -επόθην")
    assert len(parts) == 4


def test_principal_parts_of_missing_headword():
    assert principal_parts(None) == set()


def test_is_greek_form():
    assert is_greek_form("ᾰ̓γᾰθῆς") and is_greek_form("λόγῳ")
    for bad in ["", "Λόγος", "λογο" + chr(0x03F2), chr(0x03E3) + "α", chr(0x0301) + "α", "λό γος", "logos"]:
        assert not is_greek_form(bad), repr(bad)


def test_schema_form_pattern_matches_is_greek_form():
    schema = json.loads((Path(__file__).parents[1] / "schema.json").read_text(encoding="utf-8"))
    pattern = re.compile(schema["$defs"]["form"]["pattern"])
    for cp in list(range(0x0300, 0x0400)) + list(range(0x1F00, 0x2000)):
        ch = unicodedata.normalize("NFC", "α" + chr(cp)) if unicodedata.combining(chr(cp)) else chr(cp)
        assert bool(pattern.match(ch)) == is_greek_form(ch), f"U+{cp:04X}"
