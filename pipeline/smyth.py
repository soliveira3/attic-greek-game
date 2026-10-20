"""Paradigm tables from Smyth's *Greek Grammar* (1920, public domain) as served by Perseus.

Used only to cross-check the golden paradigms (compare_smyth.py); nothing from Smyth is copied
into the game's data. Perseus marks long vowels with "_", short ones with "^", and morpheme
boundaries with "-".
"""
import html
import re
import unicodedata
from dataclasses import dataclass, field

from normalize import ACUTE, CIRCUMFLEX, DIAERESIS, GRAVE, IOTA_SUBSCRIPT, key, nfc, strip_all, strip_length

NUMBERS = {"SINGULAR": "sg", "DUAL": "du", "PLURAL": "pl"}
CASE_LABELS = {
    "Nom.": ["nom"],
    "Gen.": ["gen"],
    "Dat.": ["dat"],
    "Acc.": ["acc"],
    "Voc.": ["voc"],
    "N.V.": ["nom", "voc"],
    "N.A.": ["nom", "acc"],
    "N.A.V.": ["nom", "acc", "voc"],
    "G.D.": ["gen", "dat"],
}
_LETTERS = f"{chr(0x370)}-{chr(0x3FF)}{chr(0x1F00)}-{chr(0x1FFF)}"
_MARKS = f"{chr(0x300)}-{chr(0x36F)}"
UNREADABLE = "?"  # Perseus shows "?" where a character failed to render
_LABEL = re.compile(r"^(N\.\s*A\.\s*V\.|N\.\s*V\.|N\.\s*A\.|G\.\s*D\.|Nom\.|Gen\.|Dat\.|Acc\.|Voc\.)")
_GREEK_WORD = re.compile(rf"[{_LETTERS}{_MARKS}_^\-]+")
_HAS_LETTER = re.compile(f"[{_LETTERS}]")


def smyth_form(s: str) -> str:
    """A Perseus/Smyth spelling as a comparable key: no quantity marks or morpheme hyphens."""
    return key(nfc(re.sub(r"[_^\-]", "", s.strip())))


def _text(cell: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", cell))).strip()


def parse_tables(page: str) -> list[list[list[str]]]:
    """The tables of the section text: rows of cell texts."""
    body = page[page.find('class="text"') :]
    out = []
    for table in re.findall(r"<table[^>]*>(.*?)</table>", body, re.S):
        rows = []
        for row in re.findall(r"<tr[^>]*>(.*?)</tr>", table, re.S):
            cells = re.findall(r"<td[^>]*/>|<td[^>]*>(.*?)</td>", row, re.S)
            rows.append([_text(c) for c in cells])
        out.append(rows)
    return out


def greek_words(text: str) -> list[str]:
    return [w for w in _GREEK_WORD.findall(text) if _HAS_LETTER.search(w)]


_PARENTHESISED = re.compile(r"[（(][^)）]*[)）]")
_MOVABLE_NU = re.compile(r"(\S+)[（(]ν[)）]")


def _clean_cell(cell: str) -> str:
    """Spell out movable ν ("ἀληθέσι（ν）" -> both spellings) and drop parenthesised forms."""
    return _PARENTHESISED.sub("", _MOVABLE_NU.sub(r"\1 \1ν", cell))


def _header(row: list[str]) -> list[str] | None:
    """Column words of a header row ('' label, Greek in at least one cell); a blank cell belongs
    to the word on its left (Smyth prints uncontracted and contracted sub-columns)."""
    if not row or row[0].strip() or not any(greek_words(c) for c in row[1:]):
        return None
    out: list[str] = []
    for cell in row[1:]:
        words = greek_words(cell)
        out.append(smyth_form(words[-1]) if words else (out[-1] if out else ""))
    return out


def section_columns(tables: list[list[list[str]]]) -> dict[str, dict[str, list[str]]]:
    """Noun-style tables of one section: {model word: {cell key: [forms]}}.

    The first header row of a table names the columns; a table without one continues the
    previous table's columns (Smyth often puts the dual and plural in separate tables).
    Parenthesised (uncontracted, theoretical or dialect) forms are ignored.
    """
    out: dict[str, dict[str, list[str]]] = {}
    lemmas: list[str] = []
    for table in tables:
        number = "sg"
        header_allowed = True  # only before the table's first header or data row
        for row in table:
            if len(row) == 1 and row[0] in NUMBERS:
                number = NUMBERS[row[0]]
                continue
            header = _header(row) if header_allowed else None
            if header is not None:
                lemmas, header_allowed = header, False
                continue
            m = _LABEL.match(row[0]) if row else None
            label = m.group(1).replace(" ", "") if m else ""
            if not lemmas or label not in CASE_LABELS:
                continue
            header_allowed = False
            cells = row[1:]
            if len(cells) > len(lemmas):  # a stray empty cell shifts the columns (colspan lost)
                filled = [c for c in cells if c.strip()]
                cells = filled if len(filled) == len(lemmas) else cells
            for lem, cell in zip(lemmas, cells):
                if UNREADABLE in cell:
                    forms = [UNREADABLE]
                else:
                    forms = [smyth_form(w) for w in greek_words(_clean_cell(cell))]
                for case in CASE_LABELS[label]:
                    cell_forms = out.setdefault(lem, {}).setdefault(f"{case}.{number}", [])
                    cell_forms += [f for f in forms if f not in cell_forms]
    return {lem: {k: v for k, v in cells.items() if v} for lem, cells in out.items() if lem}


def paradigm_columns(table: list[list[str]]) -> dict[str, dict[str, list[str]]]:
    """Columns of a single table (see section_columns)."""
    return section_columns([table])


# ---------------------------------------------------------------------------- comparison

_VOWELS = "αεηιουω"
_DIPHTHONGS = {"αι", "ει", "οι", "υι", "αυ", "ευ", "ηυ", "ου"}


@dataclass(frozen=True)
class Diff:
    cell: str
    ours: tuple[str, ...]
    smyth: tuple[str, ...]


@dataclass
class Comparison:
    ok: list[str] = field(default_factory=list)  # same forms
    extra: list[Diff] = field(default_factory=list)  # Smyth's forms plus alternates of ours
    fewer: list[Diff] = field(default_factory=list)  # Smyth lists alternates we lack
    differs: list[Diff] = field(default_factory=list)  # no form in common
    not_in_smyth: list[str] = field(default_factory=list)  # our cells the table does not show
    missing: list[str] = field(default_factory=list)  # Smyth's cells we lack
    unreadable: list[str] = field(default_factory=list)  # Perseus failed to render the cell


def _letters(form: str) -> list[tuple[str, set[str]]]:
    out: list[tuple[str, set[str]]] = []
    for ch in unicodedata.normalize("NFD", strip_length(nfc(form))):
        if unicodedata.combining(ch) and out:
            out[-1][1].add(ch)
        elif not unicodedata.combining(ch):
            out.append((ch, set()))
    return out


def shape(form: str, stem_len: int) -> tuple[str, tuple[str, int] | None]:
    """(ending after `stem_len` letters, (accent, syllable counted from the end)) of a form.

    Two words of the same pattern (φυγή and τιμή) have equal shapes in every cell, so a golden
    lemma with no table of its own in Smyth can be checked against a model word.
    """
    letters = _letters(form)
    ending = "".join(b + ("|" if IOTA_SUBSCRIPT in m else "") for b, m in letters[stem_len:])
    nuclei: list[tuple[int, ...]] = []
    i = 0
    while i < len(letters):
        b, _ = letters[i]
        if b in _VOWELS:
            nxt = letters[i + 1] if i + 1 < len(letters) else None
            if nxt and b + nxt[0] in _DIPHTHONGS and DIAERESIS not in nxt[1]:
                nuclei.append((i, i + 1))
                i += 2
                continue
            nuclei.append((i,))
        i += 1
    for pos, nucleus in enumerate(reversed(nuclei)):
        marks = set().union(*(letters[j][1] for j in nucleus))
        if ACUTE in marks or GRAVE in marks:
            return ending, ("acute", pos)
        if CIRCUMFLEX in marks:
            return ending, ("circumflex", pos)
    return ending, None


def stem_length(cells: dict[str, list[str]]) -> int:
    """Letters shared by every form of a paradigm (accent-free)."""
    words = [strip_all(f) for fs in cells.values() for f in fs]
    n = 0
    while words and all(len(w) > n and w[n] == words[0][n] for w in words):
        n += 1
    return n


def _classify(cell: str, mine: set, theirs: set, ours: list[str], smyth: list[str], result: Comparison) -> None:
    diff = Diff(cell, tuple(ours), tuple(smyth))
    if mine == theirs:
        result.ok.append(cell)
    elif theirs < mine:
        result.extra.append(diff)
    elif mine < theirs:
        result.fewer.append(diff)
    else:
        result.differs.append(diff)


def compare(ours: dict[str, list[str]], smyth: dict[str, list[str]], model: dict[str, list[str]] | None = None) -> Comparison:
    """Compare golden cells with Smyth's column for the same word, or (with `model`) with the
    column of a model word of the same pattern, by shape."""
    result = Comparison()
    if model is None:
        mine_of = lambda forms: {key(f) for f in forms}  # noqa: E731
        theirs_of = lambda forms: set(forms)  # noqa: E731
    else:
        ours_stem, model_stem = stem_length(ours), stem_length(model)
        mine_of = lambda forms: {shape(f, ours_stem) for f in forms}  # noqa: E731
        theirs_of = lambda forms: {shape(f, model_stem) for f in forms}  # noqa: E731
    for cell in sorted(set(ours) | set(smyth)):
        if cell not in smyth:
            result.not_in_smyth.append(cell)
        elif UNREADABLE in smyth[cell]:
            result.unreadable.append(cell)
        elif cell not in ours:
            result.missing.append(cell)
        else:
            _classify(cell, mine_of(ours[cell]), theirs_of(smyth[cell]), ours[cell], smyth[cell], result)
    return result


def section_forms(tables: list[list[list[str]]], stem: str) -> set[str]:
    """Every form printed in a section's tables whose accent-free letters start with `stem`."""
    out = set()
    for table in tables:
        for row in table:
            for cell in row:
                for w in greek_words(_clean_cell(cell)):
                    form = smyth_form(w)
                    if strip_all(form).startswith(stem):
                        out.add(form)
    return out


@dataclass
class FormComparison:
    both: list[str] = field(default_factory=list)
    only_ours: list[tuple[str, list[str]]] = field(default_factory=list)  # (form, cells)
    only_smyth: list[str] = field(default_factory=list)


def compare_forms(ours: dict[str, list[str]], smyth: set[str]) -> FormComparison:
    """Spelling-level comparison for tables whose cells cannot be aligned reliably."""
    cells_of: dict[str, list[str]] = {}
    for cell, forms in ours.items():
        for f in forms:
            cells_of.setdefault(key(f), []).append(cell)
    result = FormComparison()
    for form, cells in sorted(cells_of.items()):
        if form in smyth:
            result.both.append(form)
        else:
            result.only_ours.append((form, cells))
    result.only_smyth = sorted(smyth - set(cells_of))
    return result


# ---------------------------------------------------------------------------- verbs

_TENSE_WORDS = (("Future Perfect", None), ("Pluperfect", None), ("Imperfect", "impf"),
                ("Present", "pres"), ("Future", "fut"), ("Aorist", "aor"), ("Perfect", "perf"))
_VOICE_WORDS = (("Active", "act"), ("Middle", "mid"), ("Passive", "pass"))
_MOODS = {"INDICATIVE.": "ind", "IND.": "ind", "INFINITIVE.": "inf", "INF.": "inf"}
_OTHER_MOODS = {"SUBJUNCTIVE.", "SUBJ.", "OPTATIVE.", "OPT.", "IMPERATIVE.", "IMP.", "PARTICIPLE.", "PART."}
_PERSON = re.compile(r"^(?:([SDP])\.\s*)?([123])\.\s*")
_NUMBER_LETTERS = {"S": "sg", "D": "du", "P": "pl"}


def _tense_header(cell: str) -> tuple[str | None, str | None] | None:
    """(tense or None for out-of-scope tenses, voice or None) of a column header, or None."""
    for word, tense in _TENSE_WORDS:
        if word in cell:
            voice = next((v for w, v in _VOICE_WORDS if w in cell), None)
            return tense, voice
    return None


def verb_columns(tables: list[list[list[str]]], voices: list[str]) -> dict[str, list[str]]:
    """Indicative and infinitive cells of Smyth's conjugation tables, in the project's keys.

    `voices` gives each table's voice (the section text, not the table, says which is which);
    a column header naming a voice ("2 Aorist Middle") or a "PASSIVE VOICE" row overrides it.
    In the present, imperfect and perfect the middle is the shared middle/passive (mp).
    """
    out: dict[str, list[str]] = {}
    for index, table in enumerate(tables):
        voice = voices[min(index, len(voices) - 1)]
        columns: list[tuple[str | None, str | None]] | None = None
        mood: str | None = None
        number, person = "sg", "1"
        for row in table:
            if len(row) == 1 and "PASSIVE VOICE" in row[0]:
                voice = "pass"
                continue
            first = row[0].strip() if row else ""
            if columns is None and first == "":
                headers = [_tense_header(c) for c in row[1:]]
                if any(headers):
                    columns = [h or (None, None) for h in headers]
                    continue
            if first in _MOODS:
                mood = _MOODS[first]
            elif first in _OTHER_MOODS:
                mood = None
            if columns is None or mood is None or len(row) < 2:
                continue
            cells = row[1:]
            if mood == "ind":
                m = _PERSON.match(cells[0])
                if not m:
                    continue
                number = _NUMBER_LETTERS.get(m.group(1) or "", number)
                person = m.group(2)
                cells = [cells[0][m.end():]] + cells[1:]
            for (tense, column_voice), cell in zip(columns, cells):
                if tense is None:
                    continue
                v = column_voice or voice
                group = "mp" if v == "mid" and tense in ("pres", "impf", "perf") else v
                cell_key = f"{tense}.{group}.ind.{person}.{number}" if mood == "ind" else f"{tense}.{group}.inf"
                forms = [smyth_form(w) for w in greek_words(_clean_cell(cell))]
                merged = out.setdefault(cell_key, [])
                merged += [f for f in forms if f not in merged]
    return {k: v for k, v in out.items() if v}
