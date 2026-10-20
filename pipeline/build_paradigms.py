"""Build data/paradigms/{nouns,adjectives,verbs}.json and data/paradigms/REPORT.md.

Usage: python build_paradigms.py

Reads data/core_list.csv, data/extra_lemmas.csv, data/exclude.txt and the kaikki dump named in
pipeline/sources.json. Every form in the output is copied from the dump; nothing is invented or
corrected here. Doubtful data is reported, and removed only through data/exclude.txt.
"""
import csv
import json
import re
import sys
from collections import Counter
from collections.abc import Iterable
from dataclasses import dataclass, field
from pathlib import Path

from classify import aorist_types, classify_adj, classify_noun, classify_verb
from core_list import read_core_list
from exclusions import Rule, apply_rules, parse_exclusions
from kaikki import Picked, Table, is_greek_form, iter_entries, pick_tables, tables
from normalize import key, nfc, strip_accents, strip_length
from select_tables import MappedTable, principal_parts, select
from tags import CASE, GENDER, NUMBER, Skip, nominal_cells, verb_cells

ROOT = Path(__file__).resolve().parent.parent
PIPELINE = ROOT / "pipeline"
DATA = ROOT / "data"
OUT_DIR = DATA / "paradigms"
REPORT = OUT_DIR / "REPORT.md"
MORPHEUS_START, MORPHEUS_END = "<!-- morpheus:start -->", "<!-- morpheus:end -->"

INFLECTED = ("noun", "adj", "article", "verb")
# Wiktionary files some DCC adjectives (οἷος, δεύτερος) as determiners, numerals or pronouns.
POS_ALIASES = {"adj": ("adj", "num", "det", "pron")}


def dump_pos(pos: str) -> tuple[str, ...]:
    return POS_ALIASES.get(pos, (pos,))
FILES = {"noun": "nouns.json", "adj": "adjectives.json", "article": "adjectives.json", "verb": "verbs.json"}

CASES = list(CASE.values())
NUMBERS = list(NUMBER.values())
GENDERS = list(GENDER.values())
TENSES = ["pres", "impf", "fut", "aor", "perf"]
VOICE_GROUPS = ["act", "mid", "pass", "mp"]
PERSONS = ["1", "2", "3"]


@dataclass(frozen=True)
class Candidate:
    lemma: str
    pos: str
    gloss: str | None
    rank: int | None
    dcc_pos: str | None
    in_dcc: bool
    headword: str | None = None  # DCC headword with principal parts ("λύω, λύσω, ἔλυσα, …")


@dataclass
class Built:
    lemma: dict
    notes: Counter = field(default_factory=Counter)
    anomalies: list[str] = field(default_factory=list)
    exclusions: list[tuple[Rule, str]] = field(default_factory=list)
    dropped_blocks: dict[str, str] = field(default_factory=dict)
    competing: dict[str, list[str]] = field(default_factory=dict)
    picked: Picked | None = None
    choices: list[str] = field(default_factory=list)  # how verb tables were chosen


@dataclass
class Rejected:
    reason: str  # "not in dump" | "no Attic table" | "out of scope" | "incomplete" | "excluded"
    detail: str = ""
    anomalies: list[str] = field(default_factory=list)
    excluded_by: list[Rule] = field(default_factory=list)


# ---------------------------------------------------------------------------- entry selection


class Index(dict):
    """(key(word), pos) -> entries, plus `attic_alts`: (key(target), pos) -> "Attic form of" entries
    and `by_letters`: (accent-free word, pos) -> entries."""

    def __init__(self) -> None:
        super().__init__()
        self.attic_alts: dict[tuple[str, str], list[dict]] = {}
        self.by_letters: dict[tuple[str, str], list[dict]] = {}


def attic_alt_targets(entry: dict) -> list[str]:
    """Headwords this entry is labelled "Attic form of"."""
    out = []
    for sense in entry.get("senses", []):
        tags = sense.get("tags", [])
        if "Attic" in tags and "alt-of" in tags:
            out += [key(a["word"]) for a in sense.get("alt_of", []) if a.get("word")]
    return out


def index_entries(entries: Iterable[dict]) -> Index:
    index = Index()
    for e in entries:
        index.setdefault((key(e["word"]), e["pos"]), []).append(e)
        index.by_letters.setdefault((strip_accents(e["word"]), e["pos"]), []).append(e)
        for target in attic_alt_targets(e):
            index.attic_alts.setdefault((target, e["pos"]), []).append(e)
    return index


def select_entry(c: Candidate, index: Index) -> tuple[list[dict], str | None, list[dict]]:
    """The entries to build from, the DCC headword (None for extra lemmas), and supplements.

    A DCC headword with -σσ- is replaced by its "Attic form of" entry spelt with -ττ-; the -σσ-
    entries are returned as supplements, since the -ττ- entry often lacks tenses whose forms
    have no σσ at all (πράξω, ἔπραξα).
    """
    dcc_lemma = c.lemma if c.in_dcc else None
    k = key(c.lemma)
    for pos in dump_pos(c.pos):
        if c.in_dcc and "σσ" in k:
            attic = [e for e in index.attic_alts.get((k, pos), []) if key(e["word"]) == k.replace("σσ", "ττ")]
            if attic:
                return attic, dcc_lemma, index.get((k, pos), [])
        if index.get((k, pos)):
            entries = index[(k, pos)]
            if c.gloss and not any(gloss_overlap(c.gloss, e) for e in entries):
                # DCC accent slip (πεμπτός "fifth" is Wiktionary's πέμπτος; πεμπτός means "sent")
                same_letters = [
                    e for e in index.by_letters.get((strip_accents(k), pos), [])
                    if key(e["word"]) != k and gloss_overlap(c.gloss, e)
                ]
                if same_letters:
                    return same_letters, dcc_lemma, []
            return entries, dcc_lemma, []
    return [], dcc_lemma, []


def article_forms_from(entry: dict) -> set[str]:
    """Accent-free forms of the article, for spotting an article written inside a noun form."""
    picked = pick_tables(tables(entry), "article")
    return {strip_accents(f) for t in picked.kept for f, _ in t.forms if is_greek_form(f)}


# ---------------------------------------------------------------------------- building


def _clean(raw: str, article_forms: set[str], notes: Counter, anomalies: list[str]) -> list[str]:
    s = nfc(raw.strip())
    if s in ("-", "—", "–"):
        notes["empty-cell placeholders skipped"] += 1
        return []
    if re.search(r"[A-Za-z]", s):
        notes["romanization rows dropped"] += 1
        return []
    if " " in s:
        tokens = s.split()
        if len(tokens) == 2 and strip_accents(tokens[0]) in article_forms:
            s = tokens[1]
            notes["article stripped from form"] += 1
        else:
            anomalies.append(f"{raw!r}: several words")
            return []
    variants = [s]
    m = re.fullmatch(r"(.+)\((\w+)\)", s)
    if m:
        variants = [m.group(1), m.group(1) + m.group(2)]
        notes["parenthesised alternates expanded"] += 1
    out = []
    for v in variants:
        if is_greek_form(v):
            out.append(v)
        else:
            anomalies.append(f"{raw!r}: unexpected characters")
    return out


def _noun_genders(entry: dict) -> list[str]:
    found: set[str] = set()
    for row in entry.get("forms", []):
        if "canonical" in row.get("tags", []):
            found |= {GENDER[t] for t in row["tags"] if t in GENDER}
    if not found:
        for h in entry.get("head_templates", []):
            if h.get("name") == "grc-noun":
                for arg in ("2", "g2"):
                    found |= set(h["args"].get(arg, "")) & set(GENDERS)
    return [g for g in GENDERS if g in found]


def _first_gloss(entry: dict) -> str:
    for sense in entry.get("senses", []):
        if sense.get("glosses"):
            return sense["glosses"][0]
    return ""


def _sort_key(cell: dict) -> tuple:
    if "tense" in cell:
        return (
            TENSES.index(cell["tense"]),
            VOICE_GROUPS.index(cell["key"].split(".")[1]),
            cell["mood"] != "ind",
            NUMBERS.index(cell.get("number", "sg")),
            PERSONS.index(cell.get("person", "1")),
        )
    return (
        GENDERS.index(cell.get("gender", "m")),
        NUMBERS.index(cell["number"]),
        CASES.index(cell["case"]),
    )


def _required_nominal(pos: str) -> list[str]:
    cases = [c for c in CASES if not (pos == "article" and c == "voc")]
    if pos == "noun":
        return [f"{c}.{n}" for n in ("sg", "pl") for c in cases]
    return [f"{c}.{n}.{g}" for g in GENDERS for n in ("sg", "pl") for c in cases]


def _differs_only_by_nu(forms: list[str]) -> bool:
    bare = sorted({strip_length(f) for f in forms}, key=len)
    return len(bare) == 2 and bare[1] == bare[0] + "ν"


def _merge_middle_into_mp(features: dict[str, dict], forms: dict[str, list[str]], notes: Counter) -> None:
    """In the present, imperfect and perfect, middle and passive share one form (SPEC §2).

    Some tables tag those forms "middle" only (deponents, some -σκω verbs); file them under the
    shared middle/passive block unless the tense also has a separate passive block.
    """
    for tense in ("pres", "impf", "perf"):
        mid = [k for k in forms if k.startswith(f"{tense}.mid.")]
        if not mid or any(k.startswith((f"{tense}.pass.", f"{tense}.mp.")) for k in forms):
            continue
        for k in mid:
            new = k.replace(".mid.", ".mp.", 1)
            features[new] = {**features.pop(k), "key": new, "voice": ["mid", "pass"]}
            forms[new] = forms.pop(k)
        notes["middle-only present/imperfect/perfect filed as middle/passive"] += 1


PRESENT_SYSTEM = ("pres", "impf", "perf")
# Cells a block may lack: the Attic perfect middle/passive 3rd plural of consonant stems is a
# periphrasis (participle + εἰσί), which v1 does not model.
OPTIONAL_CELLS = {"perf.mp": {"perf.mp.ind.3.pl"}}


def _map_table(c: Candidate, t: Table, article_forms: set[str], notes: Counter, anomalies: list[str]) -> tuple[dict[str, list[str]], dict[str, dict]]:
    """Cells of one source table: key -> forms, and key -> features."""
    forms: dict[str, list[str]] = {}
    features: dict[str, dict] = {}
    for raw, tags in t.forms:
        mapped = (
            verb_cells(tags, t.tense or "")
            if c.pos == "verb"
            else nominal_cells(tags, with_gender=c.pos != "noun")
        )
        if isinstance(mapped, Skip):
            if mapped.anomaly:
                anomalies.append(f"{raw} {tags}: {mapped.reason}")
            continue
        for form in _clean(raw, article_forms, notes, anomalies):
            if mapped.note:
                notes[mapped.note] += 1
            for cell in mapped:
                features[cell["key"]] = cell
                cell_forms = forms.setdefault(cell["key"], [])
                if strip_length(form) not in {strip_length(f) for f in cell_forms}:
                    cell_forms.append(form)
    return forms, features


def _build_one(
    c: Candidate, entry: dict, dcc_lemma: str | None, article_forms: set[str], rules: list[Rule], supplements: list[dict]
) -> Built | Rejected:
    picked = pick_tables(tables(entry), c.pos)
    word = nfc(entry["word"])
    names = {key(word)} | ({key(dcc_lemma)} if dcc_lemma else set())
    choices: list[str] = []
    if c.pos == "verb":
        for sup in supplements:
            for t in pick_tables(tables(sup), "verb").kept:
                if not any("σσ" in key(f) for f, _ in t.forms):
                    picked.kept.append(t)
                    choices.append(f"`{t.label}` of the {nfc(sup['word'])} entry is a candidate (it has no -σσ- forms)")

    excl: list[tuple[Rule, str]] = []
    kept: list[Table] = []
    for t in picked.kept:
        hits = [r for r in rules if r.scope == "table" and r.lemma in names and any(key(f) == r.form for f, _ in t.forms)]
        excl += [(r, f"removed table `{t.label}`") for r in hits]
        if not hits:
            kept.append(t)
    if not kept:
        return Rejected("no Attic table", ", ".join(picked.dropped_dialect + picked.out_of_scope) or "no tables")

    notes: Counter = Counter()
    anomalies: list[str] = []
    if c.pos == "verb":
        mapped = []
        for t in kept:
            forms, features = _map_table(c, t, article_forms, notes, anomalies)
            _merge_middle_into_mp(features, forms, notes)
            mapped.append(MappedTable(t.label, t.tense or "", forms, features))
        selection = select(word, mapped, principal_parts(c.headword))
        forms, features = selection.cells, selection.features
        choices += selection.notes
        for k in [k for k in forms if k.split(".")[0] in PRESENT_SYSTEM and k.split(".")[1] == "pass"]:
            del forms[k]
            notes["separate passive cells in present/imperfect/perfect dropped (SPEC §2)"] += 1
    else:
        forms, features = _map_table(c, kept[0], article_forms, notes, anomalies)
        choices += [f"`{t.label}` (table {n}) ignored: nominals use the first Attic table" for n, t in enumerate(kept[1:], start=2)]

    for name in dict.fromkeys([word, dcc_lemma] if dcc_lemma else [word]):
        remaining, effects = apply_rules(name, forms, rules)
        excl += effects
        if remaining is None:
            return Rejected("excluded", "; ".join(r.text for r, _ in effects), excluded_by=[r for r, _ in effects])
        forms = remaining

    lemma: dict = {"id": word, "lemma": word, "dccLemma": dcc_lemma, "pos": c.pos}
    dropped: dict[str, str] = {}
    if c.pos == "verb":
        cls = classify_verb(word)
        if isinstance(cls, Skip):
            return Rejected("out of scope", cls.reason, anomalies)
        _, root = aorist_types(forms)
        if root:
            for k in [k for k in forms if k.startswith("aor.act.")]:
                del forms[k]
            dropped["aor.act"] = "root aorist (out of scope)"
        blocks = sorted({k.split(".ind.")[0] for k in forms if ".ind." in k})
        for block in blocks:
            need = [f"{block}.ind.{p}.{n}" for n in ("sg", "pl") for p in PERSONS]
            missing = [k for k in need if k not in forms]
            if missing and set(missing) <= OPTIONAL_CELLS.get(block, set()):
                notes[f"{block} kept without its periphrastic 3rd plural"] += 1
            elif missing:
                for k in [k for k in forms if k.startswith(block + ".ind.")]:
                    del forms[k]
                dropped[block] = "missing " + ", ".join(m.split(".ind.")[1] for m in missing)
        for k in [k for k in forms if k.endswith(".inf")]:
            if not any(other.startswith(k[: -len("inf")] + "ind.") for other in forms):
                del forms[k]
                dropped[k] = "infinitive without an indicative block"
        if not any(k.startswith(("pres.act.ind.", "pres.mp.ind.")) for k in forms):
            return Rejected("incomplete", "no complete present indicative block", anomalies)
        lemma["class"] = cls
        lemma["aoristType"] = aorist_types(forms)[0]
    else:
        missing = [k for k in _required_nominal(c.pos) if k not in forms]
        if missing:
            return Rejected("incomplete", "missing " + ", ".join(missing), anomalies)
        decl = kept[0].declension_class
        if c.pos == "noun":
            genders = _noun_genders(entry)
            cls = classify_noun(decl, forms["nom.sg"][0], forms["gen.sg"][0], genders, c.dcc_pos)
            lemma["gender"] = genders
        elif c.pos == "adj":
            cls = classify_adj(decl, forms)
        else:
            cls = "article"
        if isinstance(cls, Skip):
            return Rejected("out of scope", cls.reason, anomalies)
        lemma["class"] = cls

    lemma["gloss"] = c.gloss or _first_gloss(entry)
    lemma["rank"] = c.rank
    cells = [{**features[k], "forms": v} for k, v in forms.items()]
    lemma["cells"] = sorted(cells, key=_sort_key)
    # put keys in schema order
    order = ["id", "lemma", "dccLemma", "pos", "class", "gender", "aoristType", "gloss", "rank", "cells"]
    lemma = {k: lemma[k] for k in order if k in lemma}
    competing = {
        k: v for k, v in forms.items() if len({strip_length(f) for f in v}) > 1 and not _differs_only_by_nu(v)
    }
    return Built(lemma, notes, anomalies, excl, dropped, competing, picked, choices)


_STOPWORDS = frozenset({"a", "an", "the", "to", "of", "in", "on", "and", "or", "for", "with", "be", "etc"})


def _gloss_words(text: str) -> set[str]:
    return set(re.findall(r"[a-z]+", text.lower())) - _STOPWORDS


def gloss_overlap(gloss: str, entry: dict) -> int:
    """Words shared by a DCC gloss and the entry's Wiktionary glosses."""
    have = set().union(*(_gloss_words(g) for s in entry.get("senses", []) for g in s.get("glosses", [])))
    return len(_gloss_words(gloss) & have)


def order_by_gloss(gloss: str | None, entries: list[dict]) -> list[dict]:
    """Homograph entries, best match for the DCC gloss first (stable for ties)."""
    if not gloss or len(entries) < 2:
        return entries
    return sorted(entries, key=lambda e: gloss_overlap(gloss, e), reverse=True)


def build_lemma(
    c: Candidate,
    entries: list[dict],
    dcc_lemma: str | None,
    article_forms: set[str],
    rules: list[Rule],
    supplements: list[dict] | None = None,
) -> Built | Rejected:
    if not entries:
        return Rejected("not in dump")
    entries = order_by_gloss(c.gloss, entries)
    first: Rejected | None = None
    for i, entry in enumerate(entries):
        result = _build_one(c, entry, dcc_lemma, article_forms, rules, supplements or [])
        if isinstance(result, Built):
            if len(entries) > 1:
                result.notes[f"{len(entries)} entries in dump; used the one glossed {_first_gloss(entry)!r}"] += 1
            return result
        first = first or result
    assert first is not None
    return first


# ---------------------------------------------------------------------------- output


def render_json(lemmas: list[dict], source: dict) -> str:
    """Pretty JSON with one cell per line, so diffs stay readable."""
    dump = lambda v: json.dumps(v, ensure_ascii=False)  # noqa: E731
    out = ["{", '  "schemaVersion": 1,', f'  "source": {dump(source)},', '  "lemmas": [']
    for i, lemma in enumerate(lemmas):
        out.append("    {")
        for k, v in lemma.items():
            if k != "cells":
                out.append(f"      {dump(k)}: {dump(v)},")
        out.append('      "cells": [')
        cells = lemma["cells"]
        out += [f"        {dump(c)}" + ("," if j < len(cells) - 1 else "") for j, c in enumerate(cells)]
        out.append("      ]")
        out.append("    }" + ("," if i < len(lemmas) - 1 else ""))
    out += ["  ]", "}"]
    return "\n".join(out) + "\n"


def _md_list(items: list[str]) -> list[str]:
    return [f"- {i}" for i in items] if items else ["(none)"]


def render_report(candidates: list[Candidate], results: dict[Candidate, Built | Rejected], sources: dict, rules: list[Rule]) -> str:
    built = {c: r for c, r in results.items() if isinstance(r, Built)}
    rejected = {c: r for c, r in results.items() if isinstance(r, Rejected)}
    k = sources["kaikki"]
    lines = [
        "# Paradigm build report",
        "",
        f"Generated by `pipeline/build_paradigms.py` from the kaikki.org dump extracted {k['extracted']} "
        f"(enwiktionary {k['wiktionary_dump']}) and the DCC core list retrieved {sources['dcc']['retrieved']}.",
        "Do not edit by hand; rerun the pipeline. Decisions about this report go in `data/exclude.txt` (with a comment).",
        "",
        "## Summary",
        "",
        "| POS | candidates | included | not in dump | no Attic table | out of scope | incomplete | excluded |",
        "|---|---|---|---|---|---|---|---|",
    ]
    for pos in INFLECTED:
        cs = [c for c in candidates if c.pos == pos]
        reasons = Counter(r.reason for c, r in rejected.items() if c.pos == pos)
        lines.append(
            f"| {pos} | {len(cs)} | {sum(1 for c in cs if c in built)} | {reasons['not in dump']} | "
            f"{reasons['no Attic table']} | {reasons['out of scope']} | {reasons['incomplete']} | {reasons['excluded']} |"
        )
    by_class = Counter(b.lemma["class"] for b in built.values())
    lines += ["", "Included lemmas by class: " + ", ".join(f"`{c}` {n}" for c, n in sorted(by_class.items())), ""]

    lines += ["## DCC headword → Wiktionary entry used (Attic -ττ- spelling or a DCC accent slip)", ""]
    lines += _md_list([f"{b.lemma['dccLemma']} → {b.lemma['lemma']}" for b in built.values() if b.lemma["dccLemma"] and key(b.lemma["dccLemma"]) != key(b.lemma["lemma"])])

    for reason, title in [
        ("not in dump", "Not found in the dump"),
        ("no Attic table", "No Attic table"),
        ("out of scope", "Out of scope for v1"),
        ("incomplete", "Incomplete (lemma dropped)"),
        ("excluded", "Excluded by data/exclude.txt"),
    ]:
        lines += ["", f"## {title}", ""]
        lines += _md_list([f"{c.lemma} ({c.pos}): {r.detail}".rstrip(": ") for c, r in rejected.items() if r.reason == reason])

    lines += ["", "## Verb blocks dropped", ""]
    lines += _md_list([f"{b.lemma['lemma']} `{blk}`: {why}" for b in built.values() for blk, why in b.dropped_blocks.items()])

    lines += ["", "## Competing forms (all kept as alternates; movable-ν pairs not listed)", ""]
    lines += _md_list([f"{b.lemma['lemma']} `{cell}`: {' / '.join(fs)}" for b in built.values() for cell, fs in b.competing.items()])

    lines += ["", "## Source anomalies (rows dropped)", ""]
    lines += _md_list(
        [f"{c.lemma}: {a}" for c, r in results.items() for a in r.anomalies]
    )

    lines += ["", "## Notes", "", "| note | count |", "|---|---|"]
    notes: Counter = Counter()
    for b in built.values():
        notes.update({n: v for n, v in b.notes.items() if "entries in dump" not in n})
    lines += [f"| {n} | {v} |" for n, v in sorted(notes.items())]
    multi = [f"{b.lemma['lemma']} ({n})" for b in built.values() for n in b.notes if "entries in dump" in n]
    lines += ["", "Lemmas with several dump entries of the same POS: " + (", ".join(multi) or "none")]

    lines += ["", "## Non-Attic tables dropped", ""]
    lines += _md_list([f"{b.lemma['lemma']}: {', '.join(b.picked.dropped_dialect)}" for b in built.values() if b.picked and b.picked.dropped_dialect])
    lines += ["", "## Attic tables superseded by a better-ranked table of the same tense", ""]
    lines += _md_list([f"{b.lemma['lemma']}: {', '.join(b.picked.superseded)}" for b in built.values() if b.picked and b.picked.superseded])

    lines += ["", "## Table choices (see pipeline/select_tables.py)", ""]
    lines += _md_list([f"{b.lemma['lemma']} {n}" for b in built.values() for n in b.choices])

    lines += ["", "## data/exclude.txt rules", ""]
    applied = {(r.line): eff for b in built.values() for r, eff in b.exclusions}
    applied.update({r.line: "removed lemma" for x in rejected.values() for r in x.excluded_by})
    lines += _md_list([f"line {r.line} `{r.text}`: {applied.get(r.line, '**matched nothing**')}" for r in rules])
    lines.append("")
    return "\n".join(lines)


def _keep_morpheus_section(new_report: str) -> str:
    if REPORT.exists():
        old = REPORT.read_text(encoding="utf-8")
        if MORPHEUS_START in old and MORPHEUS_END in old:
            section = old[old.index(MORPHEUS_START) : old.index(MORPHEUS_END) + len(MORPHEUS_END)]
            return new_report + "\n" + section + "\n"
    return new_report + "\n" + MORPHEUS_START + "\n## Morpheus cross-check\n\nNot run yet: `python crosscheck_morpheus.py`.\n" + MORPHEUS_END + "\n"


def load_candidates() -> list[Candidate]:
    out = [
        Candidate(r.lemma, r.pos, r.gloss, r.rank, r.dcc_pos, True, r.headword)
        for r in read_core_list(DATA / "core_list.csv")
        if r.pos in INFLECTED
    ]
    with (DATA / "extra_lemmas.csv").open(encoding="utf-8", newline="") as f:
        out += [Candidate(nfc(r["lemma"]), r["pos"], None, None, None, False) for r in csv.DictReader(f)]
    return out


def scan_dump(path: Path, candidates: list[Candidate]) -> Index:
    wanted = {(key(c.lemma), pos) for c in candidates for pos in dump_pos(c.pos)}
    # entries spelt with the same letters but other accents, for DCC accent slips
    wanted_letters = {(strip_accents(k), pos) for k, pos in wanted}
    keep = []
    for e in iter_entries(path):
        pos = e.get("pos")
        if (
            (key(e["word"]), pos) in wanted
            or (strip_accents(e["word"]), pos) in wanted_letters
            or any((t, pos) in wanted for t in attic_alt_targets(e))
        ):
            keep.append(e)
    return index_entries(keep)


def main() -> int:
    sources = json.loads((PIPELINE / "sources.json").read_text(encoding="utf-8"))
    dump = PIPELINE / sources["kaikki"]["file"]
    if not dump.exists():
        print(f"missing {dump}; download it from {sources['kaikki']['url']}", file=sys.stderr)
        return 1
    exclude = DATA / "exclude.txt"
    rules = parse_exclusions(exclude.read_text(encoding="utf-8")) if exclude.exists() else []
    candidates = load_candidates()
    index = scan_dump(dump, candidates)
    (article_entry,) = index[(key("ὁ"), "article")]
    article_forms = article_forms_from(article_entry)

    results: dict[Candidate, Built | Rejected] = {}
    for c in candidates:
        entries, dcc_lemma, supplements = select_entry(c, index)
        results[c] = build_lemma(c, entries, dcc_lemma, article_forms, rules, supplements)

    source = {
        "kaikki": sources["kaikki"]["extracted"],
        "wiktionary": sources["kaikki"]["wiktionary_dump"],
        "dcc": sources["dcc"]["retrieved"],
    }
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    built = [r.lemma for r in results.values() if isinstance(r, Built)]
    rank = lambda lem: (lem["rank"] is None, lem["rank"] or 0, lem["lemma"])  # noqa: E731
    for name in sorted(set(FILES.values())):
        lemmas = sorted([lem for lem in built if FILES[lem["pos"]] == name], key=rank)
        (OUT_DIR / name).write_text(render_json(lemmas, source), encoding="utf-8")
        print(f"{name}: {len(lemmas)} lemmas")
    REPORT.write_text(_keep_morpheus_section(render_report(candidates, results, sources, rules)), encoding="utf-8")
    print(f"report: {REPORT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
