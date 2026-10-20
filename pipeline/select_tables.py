"""Choose which Wiktionary tables supply each tense-voice block of a verb.

Wiktionary often prints several tables for one tense: the main paradigm, rarer or poetic
alternatives, Ionic iteratives, or forms of a homonymous verb. The DCC headword lists the verb's
principal parts ("παύω, παύσω, ἔπαυσα, πέπαυκα, πέπαυμαι, ἐπαύθην"), which tell us which of those
tables is the standard Attic paradigm. Principal parts are matched against the 1st singular
indicative and infinitive cells only; the present matches only the lemma, the other tenses only
the other parts (πίνω's future πίομαι also appears in a stray "present" table). Rules, per tense
and voice group (act, mid, pass, mp):

1. Use every table whose forms in that voice include a principal part (alternates merged).
2. In the present, future and perfect, if the tense has a principal part in the middle but none
   in the active, the active is dropped: DCC gives ἀκούω's future as ἀκούσομαι, so ἀκούσω is not
   Attic; a perfect active found next to a middle part is often a stray (τρέφω's τέτραφα) or
   compound-only (DCC "-ελήλακα"). In the aorist a missing part means DCC left it out, and a
   passive part says nothing about the active (λέγω's εἶπον lives in another entry).
3. A future passive without a principal part is taken only from tables built on the chosen
   aorist passive (παυθήσομαι goes with ἐπαύθην, not παυσθήσομαι); otherwise it is dropped.
4. Otherwise, if some table of the tense has a principal part, the voice comes from the first
   such table that has it, or is dropped if none has it (ἐτεύχθην under τυγχάνω is from τεύχω).
5. If no table of the tense has a principal part (usually the imperfect), all tables are merged.

Tables of Ionic iteratives (-σκ- where the lemma has none) are dropped first. Every choice made
by rules 2-5, and every choice among several tables, is noted for the build report.
"""
import re
from dataclasses import dataclass, field

from kaikki import is_greek_form
from normalize import nfc, strip_accents, strip_all, strip_length

# The aorist comes before the future so that rule 3 can see the chosen aorist passive.
TENSE_ORDER = ("pres", "impf", "aor", "fut", "perf")


def _group(cell_key: str) -> str:
    return cell_key.split(".")[1]


@dataclass
class MappedTable:
    label: str
    tense: str
    cells: dict[str, list[str]]
    features: dict[str, dict]

    def groups(self) -> list[str]:
        return list(dict.fromkeys(_group(k) for k in self.cells))

    def principal_forms(self, group: str | None = None) -> set[str]:
        """Accent-free 1st singular indicative and infinitive forms: the slots principal parts name."""
        return {
            strip_accents(f)
            for k, fs in self.cells.items()
            if (group is None or _group(k) == group) and k.endswith((".ind.1.sg", ".inf"))
            for f in fs
        }


@dataclass
class Selection:
    cells: dict[str, list[str]] = field(default_factory=dict)
    features: dict[str, dict] = field(default_factory=dict)
    notes: list[str] = field(default_factory=list)


def principal_parts(headword: str | None) -> set[str]:
    """The Greek words of a DCC headword, accent-free for matching."""
    if not headword:
        return set()
    words = (nfc(w) for w in re.findall(r"[^\s,;.()]+", headword))
    return {strip_accents(w) for w in words if is_greek_form(w)}


def is_iterative(t: MappedTable, lemma: str) -> bool:
    if "σκ" in strip_all(lemma):
        return False
    return any("σκ" in strip_all(f) for fs in t.cells.values() for f in fs)


def _common_suffix(a: str, b: str) -> int:
    n = 0
    while n < min(len(a), len(b)) and a[-1 - n] == b[-1 - n]:
        n += 1
    return n


def _future_passives_on(aorist_tables: list[MappedTable], providers: list[MappedTable]) -> list[MappedTable]:
    """Future-passive tables whose stem is the stem of a chosen aorist passive.

    Stems (the forms minus -ην / -ησομαι) must share their last three letters, or the whole
    future stem: the augment changes the front (ἐπαύθην / παυθήσομαι, ἠνέχθην / ἐνεχθήσομαι,
    διεφθάρην / διαφθαρήσομαι), while a different stem differs at the end (παυσθήσομαι).
    """
    aorists = [strip_all(f)[:-2] for t in aorist_tables for f in t.cells.get("aor.pass.ind.1.sg", [])]

    def built_on_aorist(t: MappedTable) -> bool:
        for f in t.cells.get("fut.pass.ind.1.sg", []):
            bare = strip_all(f)
            stem = bare[: -len("ησομαι")] if bare.endswith("ησομαι") else ""
            if stem and any(_common_suffix(a, stem) >= min(3, len(stem)) for a in aorists):
                return True
        return False

    return [t for t in providers if built_on_aorist(t)]


def select(lemma: str, tables: list[MappedTable], parts: set[str]) -> Selection:
    sel = Selection()
    by_tense: dict[str, list[MappedTable]] = {}
    for t in tables:
        if is_iterative(t, lemma):
            sel.notes.append(f"`{t.label}`: iterative table dropped")
        else:
            by_tense.setdefault(t.tense, []).append(t)

    chosen: dict[tuple[str, str], list[MappedTable]] = {}
    lemma_part = {strip_accents(lemma)}
    other_parts = parts - lemma_part
    for tense in TENSE_ORDER:
        ts = by_tense.get(tense, [])
        tense_parts = lemma_part if tense == "pres" else other_parts
        groups = list(dict.fromkeys(g for t in ts for g in t.groups()))
        hits = {g: [t for t in ts if g in t.groups() and t.principal_forms(g) & tense_parts] for g in groups}
        attested = [t for t in ts if t.principal_forms() & tense_parts]
        for g in groups:
            providers = [t for t in ts if g in t.groups()]
            if hits[g]:
                pick, why = hits[g], "has a DCC principal part"
            elif g == "act" and tense in ("pres", "fut", "perf") and any(hits[o] for o in groups if o in ("mid", "mp")):
                pick, why = [], "dropped: DCC gives this tense only in the middle"
            elif g == "act" and tense == "impf" and ("pres", "act") in chosen and not chosen[("pres", "act")]:
                pick, why = [], "dropped: the present is deponent"
            elif (tense, g) == ("fut", "pass"):
                pick = _future_passives_on(chosen.get(("aor", "pass"), []), providers)
                why = "built on the chosen aorist passive" if pick else "dropped: not built on a chosen aorist passive"
            elif attested:
                pick = [t for t in attested if g in t.groups()][:1]
                why = "from the first table with a DCC principal part" if pick else "dropped: no table with a DCC principal part has it"
            else:
                pick, why = providers, "no DCC principal part for this tense; all tables merged"
            chosen[(tense, g)] = pick
            if len(providers) > 1 or not hits[g]:
                labels = ", ".join(f"`{t.label}`" for t in pick) or "none"
                sel.notes.append(f"{tense}.{g}: {why} (used {labels} of {len(providers)})")

    for (_tense, g), pick in chosen.items():
        for t in pick:
            for k, fs in t.cells.items():
                if _group(k) != g:
                    continue
                sel.features.setdefault(k, t.features[k])
                merged = sel.cells.setdefault(k, [])
                merged += [f for f in fs if strip_length(f) not in {strip_length(m) for m in merged}]
    return sel
