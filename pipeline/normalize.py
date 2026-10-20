"""Unicode normalization for Greek strings. Mirrors app/src/lib/normalize.ts.

Every comparison of Greek text in the pipeline goes through this module.
"""
import unicodedata

MACRON = chr(0x0304)
BREVE = chr(0x0306)
ACUTE = chr(0x0301)
GRAVE = chr(0x0300)
CIRCUMFLEX = chr(0x0342)
DIAERESIS = chr(0x0308)
SMOOTH = chr(0x0313)
ROUGH = chr(0x0314)
IOTA_SUBSCRIPT = chr(0x0345)

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


def _is_mark(ch: str) -> bool:
    return unicodedata.category(ch).startswith("M")


def strip_all(s: str) -> str:
    """Remove every combining mark, leaving bare letters."""
    decomposed = unicodedata.normalize("NFD", s)
    return nfc("".join(ch for ch in decomposed if not _is_mark(ch)))


def _is_word_char(ch: str) -> bool:
    return unicodedata.category(ch)[0] in "LM"


def final_sigma(s: str) -> str:
    """Use ς at the end of a word and σ elsewhere (a word is a run of letters and marks)."""
    out = []
    for i, ch in enumerate(s):
        if ch in "σς":
            ch = "σ" if i + 1 < len(s) and _is_word_char(s[i + 1]) else "ς"
        out.append(ch)
    return "".join(out)


def key(s: str) -> str:
    """Matching key for headwords: NFC without length marks."""
    return strip_length(nfc(s))
