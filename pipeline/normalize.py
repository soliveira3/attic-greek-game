"""Unicode normalization for Greek strings. Mirrors app/src/lib/normalize.ts.

Every comparison of Greek text in the pipeline goes through this module.
"""
import re
import unicodedata

MACRON = "̄"
BREVE = "̆"
ACUTE = "́"
GRAVE = "̀"
CIRCUMFLEX = "͂"
DIAERESIS = "̈"
SMOOTH = "̓"
ROUGH = "̔"
IOTA_SUBSCRIPT = "ͅ"

LENGTH_MARKS = frozenset({MACRON, BREVE})
ACCENTS = frozenset({ACUTE, GRAVE, CIRCUMFLEX})


def nfc(s: str) -> str:
    return unicodedata.normalize("NFC", s)


def _drop(s: str, marks: frozenset[str]) -> str:
    decomposed = unicodedata.normalize("NFD", s)
    return nfc("".join(ch for ch in decomposed if ch not in marks))


def strip_length(s: str) -> str:
    """Remove vowel-length marks (macron, breve)."""
    return _drop(s, LENGTH_MARKS)


def strip_accents(s: str) -> str:
    """Remove accents, diaeresis and length marks; keep breathings and iota subscript."""
    return _drop(s, LENGTH_MARKS | ACCENTS | {DIAERESIS})


def strip_all(s: str) -> str:
    """Remove every combining mark, leaving bare letters."""
    decomposed = unicodedata.normalize("NFD", s)
    return nfc("".join(ch for ch in decomposed if not unicodedata.combining(ch)))


_MEDIAL_FINAL = re.compile(r"ς(?=\w)")
_FINAL_MEDIAL = re.compile(r"σ(?!\w)")


def final_sigma(s: str) -> str:
    """Use ς at the end of a word and σ elsewhere."""
    return _FINAL_MEDIAL.sub("ς", _MEDIAL_FINAL.sub("σ", s))


def key(s: str) -> str:
    """Matching key for headwords: NFC without length marks."""
    return strip_length(nfc(s))
