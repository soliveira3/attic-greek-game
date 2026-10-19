"""Unicode Greek -> lowercase beta code, the input format Morpheus expects.

Vowel-length marks are dropped (Morpheus matches without them).
"""
import unicodedata

from normalize import strip_length

_LETTERS = {
    "α": "a", "β": "b", "γ": "g", "δ": "d", "ε": "e", "ζ": "z", "η": "h", "θ": "q",
    "ι": "i", "κ": "k", "λ": "l", "μ": "m", "ν": "n", "ξ": "c", "ο": "o", "π": "p",
    "ρ": "r", "σ": "s", "ς": "s", "τ": "t", "υ": "u", "φ": "f", "χ": "x", "ψ": "y",
    "ω": "w",
}
_MARKS = {
    "̓": ")", "̔": "(", "́": "/", "̀": "\\", "͂": "=",
    "̈": "+", "ͅ": "|",
}
# Beta code order after a letter: breathing, diaeresis, accent, iota subscript.
_ORDER = {")": 0, "(": 0, "+": 1, "/": 2, "\\": 2, "=": 2, "|": 3}


def to_beta(s: str) -> str:
    decomposed = unicodedata.normalize("NFD", strip_length(s).lower())
    out: list[str] = []
    pending: list[str] = []

    def flush() -> None:
        out.extend(sorted(pending, key=_ORDER.__getitem__))
        pending.clear()

    for ch in decomposed:
        if ch in _MARKS:
            pending.append(_MARKS[ch])
        elif ch in _LETTERS:
            flush()
            out.append(_LETTERS[ch])
        else:
            raise ValueError(f"not a Greek letter or mark: {ch!r} in {s!r}")
    flush()
    return "".join(out)
