"""Reading inflection tables from the kaikki.org (wiktextract) Ancient Greek dump."""
import json
import re
from collections.abc import Iterator
from dataclasses import dataclass, field
from pathlib import Path

TENSE_WORDS = {
    "present": "pres",
    "imperfect": "impf",
    "future": "fut",
    "aorist": "aor",
    "perfect": "perf",
}
# Rows that describe a table rather than hold a form.
META_TAGS = frozenset({"table-tags", "inflection-template", "class", "romanization", "canonical"})
GREEK_FORM = re.compile(r"^[Ͱ-Ͽἀ-῿̀-ͯ]+$")


def iter_entries(path: Path) -> Iterator[dict]:
    with path.open(encoding="utf-8") as f:
        for line in f:
            if line.strip():
                yield json.loads(line)


@dataclass
class Label:
    text: str
    dialects: list[str]
    words: list[str]

    @property
    def attic(self) -> bool:
        """Kept if the label names Attic or names no dialect at all."""
        return not self.dialects or "Attic" in self.dialects

    @property
    def attic_labelled(self) -> bool:
        return "Attic" in self.dialects

    @property
    def contracted(self) -> bool:
        return "contracted" in self.words


def parse_label(text: str) -> Label:
    """Split a table label into dialect words (capitalised) and the rest."""
    tokens = text.split()
    return Label(
        text=text,
        dialects=[t for t in tokens if t[:1].isupper()],
        words=[t for t in tokens if not t[:1].isupper()],
    )


@dataclass
class Table:
    label: str
    forms: list[tuple[str, list[str]]] = field(default_factory=list)
    declension_class: str | None = None

    @property
    def parsed(self) -> Label:
        return parse_label(self.label)

    @property
    def tense(self) -> str | None:
        """Canonical tense for a verb table whose label names exactly one in-scope tense."""
        rest = [w for w in self.parsed.words if w != "contracted"]
        return TENSE_WORDS.get(rest[0]) if len(rest) == 1 else None

    @property
    def is_declension(self) -> bool:
        rest = [w for w in self.parsed.words if w != "contracted"]
        return len(rest) == 1 and rest[0].startswith("declension-")


def tables(entry: dict) -> list[Table]:
    """The entry's inflection tables, in source order, each with its own forms."""
    out: list[Table] = []
    for row in entry.get("forms", []):
        tags = row.get("tags", [])
        if row.get("source") is None:
            continue  # headword line, not a table cell
        if "table-tags" in tags:
            out.append(Table(label=row["form"]))
            continue
        if not out:
            continue
        if "class" in tags:
            out[-1].declension_class = row["form"]
        elif not META_TAGS & set(tags):
            out[-1].forms.append((row["form"], tags))
    return out


@dataclass
class Picked:
    kept: list[Table]
    dropped_dialect: list[str] = field(default_factory=list)
    superseded: list[str] = field(default_factory=list)
    out_of_scope: list[str] = field(default_factory=list)


def _pick_group(group: list[Table], picked: Picked) -> None:
    """Choose the tables of one tense (or of the declension), keeping source order.

    1. A contracted table supersedes its uncontracted partner: the nearest earlier plain table
       with the same dialect words (Wiktionary prints the pair "future" / "contracted future").
       Other plain tables are independent paradigms and stay.
    2. "Attic"-labelled tables beat unlabelled ones, unless the unlabelled tables include a
       contracted one (then both are Attic paradigms and both stay).
    """
    gone: set[int] = set()  # indexes into group
    for i, t in enumerate(group):
        if not t.parsed.contracted:
            continue
        for j in range(i - 1, -1, -1):
            partner = group[j]
            if j not in gone and not partner.parsed.contracted and partner.parsed.dialects == t.parsed.dialects:
                gone.add(j)
                picked.superseded.append(partner.label)
                break
    alive = [t for i, t in enumerate(group) if i not in gone]
    attic = [t for t in alive if t.parsed.attic_labelled]
    plain = [t for t in alive if not t.parsed.attic_labelled]
    if attic and plain and not any(t.parsed.contracted for t in plain):
        picked.superseded += [t.label for t in plain]
        alive = attic
    picked.kept += alive


def pick_tables(ts: list[Table], pos: str) -> Picked:
    """Keep the Attic tables that are in scope (see _pick_group for how one tense is chosen)."""
    picked = Picked(kept=[])
    groups: dict[str, list[Table]] = {}
    for t in ts:
        if not t.parsed.attic:
            picked.dropped_dialect.append(t.label)
            continue
        group = t.tense if pos == "verb" else ("decl" if t.is_declension else None)
        if group is None:
            picked.out_of_scope.append(t.label)
            continue
        groups.setdefault(group, []).append(t)
    for group in groups.values():
        _pick_group(group, picked)
    return picked
