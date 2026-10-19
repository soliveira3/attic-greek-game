"""Assign each lemma to a declension or conjugation class (see `nounClass` etc. in schema.json).

Classification looks only at the bare letters of forms taken from the data, plus vowel-length
marks where the 1st declension needs them. Anything that does not fit a v1 class is a Skip.
"""
import unicodedata

from normalize import BREVE, MACRON, strip_all
from tags import Skip

_CONSONANT_STEMS = (
    ("πβφ", "decl3-labial"),
    ("κγχ", "decl3-velar"),
    ("τδθ", "decl3-dental"),
    ("λρν", "decl3-liquid"),
)


def _final_alpha_length(form: str) -> str | None:
    """'long' or 'short' if the last α carries a macron or breve, else None."""
    chars = unicodedata.normalize("NFD", form)
    last = chars.rfind("α")
    if last < 0:
        return None
    marks = []
    for ch in chars[last + 1 :]:
        if not unicodedata.combining(ch):
            break
        marks.append(ch)
    if MACRON in marks and BREVE not in marks:
        return "long"
    if BREVE in marks and MACRON not in marks:
        return "short"
    return None


def classify_noun(
    decl_class: str | None, nom: str, gen: str, genders: list[str], dcc_pos: str | None
) -> str | Skip:
    if dcc_pos and "irregular" in dcc_pos:
        return Skip(f"DCC lists it as {dcc_pos!r}")
    n, g = strip_all(nom), strip_all(gen)
    if decl_class == "First declension":
        if genders == ["m"] and n.endswith("ης"):
            return "decl1-masc-es"
        if genders == ["m"] and n.endswith("ας"):
            return "decl1-masc-as"
        if genders == ["f"] and n.endswith("η"):
            return "decl1-eta"
        if genders == ["f"] and n.endswith("α"):
            length = _final_alpha_length(nom) or ("short" if g.endswith("ης") else None)
            if length:
                return f"decl1-a-{length}"
            return Skip("1st declension α of unknown length")
        return Skip(f"1st declension {nom} ({'/'.join(genders)}) fits no v1 class")
    if decl_class == "Second declension":
        if n.endswith("ος") and set(genders) <= {"m", "f"}:
            return "decl2-mf"
        if n.endswith("ον") and genders == ["n"]:
            return "decl2-n"
        return Skip("2nd declension but not -ος/-ον (contracted or Attic declension)")
    if decl_class == "Third declension":
        if n.endswith("ευς") and g.endswith("εως"):
            return "decl3-eu"
        if n.endswith("ις") and g.endswith("εως"):
            return "decl3-i"
        if n.endswith(("υς", "υ")) and g.endswith(("εως", "υος")):
            return "decl3-u"
        if n.endswith(("ος", "ης")) and g.endswith("ους"):
            return "decl3-s"
        if g.endswith("ος"):
            stem = g[:-2]
            if stem.endswith("ντ"):
                return "decl3-nt"
            for letters, cls in _CONSONANT_STEMS:
                if stem[-1:] and stem[-1] in letters:
                    return cls
        return Skip(f"3rd declension stem of {gen} is not a v1 type")
    return Skip(f"declension class {decl_class!r}")


def _first(cells: dict[str, list[str]], key: str) -> str:
    return strip_all(cells[key][0]) if cells.get(key) else ""


def classify_adj(decl_class: str | None, cells: dict[str, list[str]]) -> str | Skip:
    m, f, n = _first(cells, "nom.sg.m"), _first(cells, "nom.sg.f"), _first(cells, "nom.sg.n")
    gen = _first(cells, "gen.sg.m")
    feminines = [strip_all(x) for x in cells.get("nom.sg.f", [])]
    if decl_class == "First and second declension" and m.endswith("ος") and n.endswith("ον"):
        # Some 2-1-2 adjectives also list a two-ending feminine (-ος) as an alternate.
        if any(x.endswith("η") for x in feminines):
            return "adj-212-eta"
        if any(x.endswith("α") for x in feminines):
            return "adj-212-alpha"
    if decl_class == "Second declension" and m.endswith("ος") and n.endswith("ον") and m == f:
        return "adj-22"
    if decl_class == "Third declension" and m == f:
        if m.endswith("ης") and n.endswith("ες"):
            return "adj-3-es"
        if m.endswith("ων") and n.endswith("ον") and gen.endswith("ονος"):
            return "adj-3-on"
    return Skip(f"adjective {m} {f} {n} ({decl_class}) fits no v1 class")


def classify_verb(lemma: str) -> str | Skip:
    b = strip_all(lemma)
    if b.endswith("μι"):
        return Skip("μι-verb")
    if b.endswith(("αω", "εω", "οω", "αομαι", "εομαι", "οομαι")):
        return Skip("contract verb (stretch goal)")
    if not b.endswith(("ω", "ομαι")):
        return Skip("not a thematic ω-verb")
    return "verb-thematic"


def aorist_types(cells: dict[str, list[str]]) -> tuple[list[str], bool]:
    """Which aorists (1st, 2nd) the verb has, and whether its active aorist is a root aorist."""
    types: set[str] = set()
    root = False
    for form in cells.get("aor.act.ind.1.sg", []):
        b = strip_all(form)
        if b.endswith("ον"):
            types.add("2")
        elif b.endswith("α"):
            types.add("1")
        else:
            root = True
    for form in cells.get("aor.mid.ind.1.sg", []):
        b = strip_all(form)
        if b.endswith("ομην"):
            types.add("2")
        elif b.endswith("αμην"):
            types.add("1")
    return sorted(types), root
