"""Compare the golden paradigms with Smyth's Greek Grammar and write data/golden/SMYTH_COMPARISON.md.

Usage: python compare_smyth.py

Smyth's tables come from Perseus (public domain text), cached in pipeline/raw/smyth/<section>.html.
The report is the evidence the user reviews before setting "verified": true in data/golden/*.json;
this script never sets that flag.
"""
import json
import sys
import time
import urllib.request
from dataclasses import dataclass
from pathlib import Path

from normalize import key, strip_all
from smyth import (
    Comparison,
    FormComparison,
    compare,
    compare_forms,
    parse_tables,
    section_columns,
    section_forms,
    smyth_form,
    stem_length,
    verb_columns,
)

ROOT = Path(__file__).resolve().parent.parent
GOLDEN = ROOT / "data" / "golden"
CACHE = ROOT / "pipeline" / "raw" / "smyth"
OUT = GOLDEN / "SMYTH_COMPARISON.md"
URL = "https://www.perseus.tufts.edu/hopper/text?doc=Perseus%3Atext%3A1999.04.0007%3Asmythp%3D{}"


@dataclass(frozen=True)
class Source:
    section: int
    kind: str  # "nominal" (cell by cell), "forms" (spellings only), "verb" (cell by cell)
    model: str | None = None  # Smyth word of the same pattern, when the golden word has no table
    voices: tuple[str, ...] = ()
    note: str = ""  # why some cells cannot be checked
    # verbs whose regular tenses Smyth prints only for a model verb: (section, voices, blocks)
    pattern: tuple[int, tuple[str, ...], tuple[str, ...]] | None = None


# Sections located by searching the downloaded Smyth tables for each word (see docs/plans/phase-2.md).
SOURCES = {
    "ὁ": Source(332, "forms"),
    "χώρα": Source(216, "nominal"),
    "θάλαττα": Source(216, "nominal"),
    "τιμή": Source(216, "nominal", model="φυγή"),
    "πολίτης": Source(222, "nominal"),
    "νεανίας": Source(222, "nominal"),
    "λόγος": Source(231, "nominal", model="ἵππος"),
    "δῶρον": Source(231, "nominal"),
    "φλέψ": Source(256, "nominal"),
    "φύλαξ": Source(256, "nominal"),
    "γέρων": Source(257, "nominal"),
    "σῶμα": Source(258, "nominal"),
    "ἡγεμών": Source(259, "nominal", note="Perseus's copy of Smyth §259 has only the singular."),
    "γένος": Source(264, "nominal"),
    "πόλις": Source(268, "nominal"),
    "ἄστυ": Source(268, "nominal"),
    "βασιλεύς": Source(
        275,
        "nominal",
        note="Perseus garbles the plural nominative row; it reads as the older spelling βασιλῆς and "
        "'later' βασιλεῖς. The game keeps only βασιλεῖς (your decision of 2026-10-19).",
    ),
    "ἀγαθός": Source(287, "forms"),
    "ἄξιος": Source(287, "forms"),
    "ἄδικος": Source(289, "forms"),
    "ἀληθής": Source(292, "forms"),
    "εὐδαίμων": Source(293, "forms"),
    "λύω": Source(383, "verb", voices=("act", "act", "mid", "mid", "pass")),
    "λείπω": Source(
        384,
        "verb",
        voices=("act",),
        note="Smyth prints only λείπω's second aorist and second perfect. Its present, imperfect, "
        "future and aorist passive indicative were compared by pattern with λύω (§383); its "
        "infinitives and perfect middle/passive could not be, because sound changes at the end of "
        "the stem make them differ from λύω's.",
        pattern=(
            383,
            ("act", "act", "mid", "mid", "pass"),
            ("pres.act", "pres.mp", "impf.act", "impf.mp", "fut.act", "fut.mid", "fut.pass", "aor.pass"),
        ),
    ),
}

CASE_NAMES = {"nom": "nominative", "gen": "genitive", "dat": "dative", "acc": "accusative", "voc": "vocative"}
NUMBER_NAMES = {"sg": "singular", "du": "dual", "pl": "plural"}
TENSE_NAMES = {"pres": "present", "impf": "imperfect", "fut": "future", "aor": "aorist", "perf": "perfect"}
VOICE_NAMES = {"act": "active", "mid": "middle", "pass": "passive", "mp": "middle/passive"}
GENDER_NAMES = {"m": "masculine", "f": "feminine", "n": "neuter"}


def cell_name(cell: str) -> str:
    p = cell.split(".")
    if p[0] in TENSE_NAMES:
        if p[2] == "inf":
            return f"{TENSE_NAMES[p[0]]} {VOICE_NAMES[p[1]]} infinitive"
        return f"{TENSE_NAMES[p[0]]} {VOICE_NAMES[p[1]]} {p[3]}{'st' if p[3] == '1' else 'nd' if p[3] == '2' else 'rd'} person {NUMBER_NAMES[p[4]]}"
    name = f"{CASE_NAMES[p[0]]} {NUMBER_NAMES[p[1]]}"
    return name + (f" {GENDER_NAMES[p[2]]}" if len(p) > 2 else "")


def _movable_nu(ours: tuple[str, ...], smyth: tuple[str, ...]) -> bool:
    """Our forms are Smyth's forms plus their movable-ν twins (λύουσι / λύουσιν for λύουσι)."""
    bare = {strip_all(f) for f in ours}
    base = {b for b in bare if b + "ν" in bare}
    return bool(base) and bare == base | {b + "ν" for b in base} and len(base) == len(set(smyth))


def summarize(c: Comparison | FormComparison) -> tuple[str, str]:
    """(status, plain-language result): status is "match", "partial" or "attention"."""
    if isinstance(c, FormComparison):
        if c.only_ours or c.only_smyth:
            return "attention", f"{len(c.both)} spellings agree; {len(c.only_ours) + len(c.only_smyth)} differ"
        return "match", f"all {len(c.both)} spellings appear in Smyth"
    nu = [d for d in c.extra if _movable_nu(d.ours, d.smyth)]
    other_extra = [d for d in c.extra if d not in nu]
    if c.differs or c.fewer or c.missing or other_extra:
        bad = len(c.differs) + len(c.fewer) + len(c.missing) + len(other_extra)
        return "attention", f"{len(c.ok) + len(nu)} cells agree; {bad} need a look"
    text = f"all {len(c.ok) + len(nu)} cells match"
    if nu:
        text += f" (in {len(nu)} we also accept the spelling with movable ν)"
    unchecked = len(c.not_in_smyth) + len(c.unreadable)
    if unchecked:
        s = "" if unchecked == 1 else "s"
        return "partial", f"{len(c.ok) + len(nu)} cells match; {unchecked} cell{s} could not be checked"
    return "match", text


def fetch(section: int) -> str:
    path = CACHE / f"{section}.html"
    if not path.exists():
        CACHE.mkdir(parents=True, exist_ok=True)
        with urllib.request.urlopen(URL.format(section), timeout=60) as resp:
            path.write_bytes(resp.read())
        time.sleep(0.5)
    return path.read_text(encoding="utf-8", errors="replace")


def _tables(section: int) -> list:
    return [t for t in parse_tables(fetch(section)) if not (t and t[0] and t[0][0] == "Greek Display:")]


def _add_pattern_checks(result: Comparison, cells: dict[str, list[str]], section: int, voices: tuple[str, ...], blocks: tuple[str, ...]) -> None:
    """Compare the indicative of each block with the model verb's, by pattern (per-block stems)."""
    model = verb_columns(_tables(section), list(voices))
    for block in blocks:
        ours = {k: v for k, v in cells.items() if k.startswith(block + ".ind.")}
        theirs = {k: v for k, v in model.items() if k.startswith(block + ".ind.")}
        if not ours or not theirs:
            continue
        r = compare(ours, theirs, model=theirs)
        result.not_in_smyth = [k for k in result.not_in_smyth if k not in ours]
        result.ok += r.ok
        result.extra += r.extra
        result.fewer += r.fewer
        result.differs += r.differs
        result.missing += r.missing
        result.not_in_smyth += r.not_in_smyth


def check(lemma: str, cells: dict[str, list[str]], src: Source) -> Comparison | FormComparison:
    tables = _tables(src.section)
    if src.kind == "verb":
        result = compare(cells, verb_columns(tables, list(src.voices)))
        if src.pattern:
            _add_pattern_checks(result, cells, *src.pattern)
        return result
    if src.kind == "forms":
        stem = "" if lemma == "ὁ" else strip_all(lemma)[: stem_length(cells)]
        return compare_forms(cells, section_forms(tables, stem))
    columns = section_columns(tables)
    word = smyth_form(src.model or lemma)
    if word not in columns:
        raise KeyError(f"{src.model or lemma} not found in Smyth §{src.section}")
    if src.model:
        return compare(cells, columns[word], model=columns[word])
    return compare(cells, columns[word])


def render(results: dict[str, tuple[Source, Comparison | FormComparison]]) -> str:
    icon = {"match": "✅", "partial": "☑️", "attention": "⚠️"}
    out = [
        "# Golden paradigms checked against Smyth",
        "",
        "Generated by `pipeline/compare_smyth.py`. Each of the reference (\"golden\") tables in",
        "`data/golden/` was compared with Smyth's *Greek Grammar* (1920), the standard reference,",
        "as digitized by the Perseus Project. A cell matches when every letter, accent, breathing",
        "and iota subscript agrees (marks of vowel length are ignored).",
        "",
        "How it was compared:",
        "- **cell by cell**: each form is compared with the form in the same slot of Smyth's table;",
        "- **by pattern**: Smyth has no table for this word, so it is compared with a word Smyth",
        "  does print that follows exactly the same pattern (same endings, accent on the same syllable);",
        "- **spellings**: Smyth's adjective and article tables do not line up into slots in the",
        "  digitized text, so the check is that every spelling we use appears in Smyth's table and",
        "  vice versa. Which slot each form belongs to was checked separately by the Morpheus",
        "  analyzer (see `data/paradigms/REPORT.md`).",
        "",
        "## Summary",
        "",
        "| Word | Smyth § | How | Result |",
        "|---|---|---|---|",
    ]
    attention, partial = [], []
    for lemma, (src, c) in results.items():
        status, text = summarize(c)
        how = "spellings" if src.kind == "forms" else (f"by pattern (like {src.model})" if src.model else "cell by cell")
        if src.pattern:
            how += " + by pattern (like λύω)"
        out.append(f"| {lemma} | {src.section} | {how} | {icon[status]} {text} |")
        if status == "attention":
            attention.append((lemma, c))
        if status == "partial" or src.note:
            partial.append((lemma, src, c))
    out += ["", "## Needs your attention", ""]
    if not attention:
        out.append("Nothing: no golden form disagrees with Smyth.")
    for lemma, c in attention:
        out.append(f"**{lemma}**")
        if isinstance(c, FormComparison):
            out += [f"- we use {f} ({', '.join(cell_name(x) for x in cells)}), which Smyth's table does not print" for f, cells in c.only_ours]
            out += [f"- Smyth prints {f}, which we do not have" for f in c.only_smyth]
        else:
            for d in c.differs:
                out.append(f"- {cell_name(d.cell)}: we have {' / '.join(d.ours)}, Smyth has {' / '.join(d.smyth)}")
            for d in c.fewer:
                out.append(f"- {cell_name(d.cell)}: Smyth also allows {' / '.join(set(d.smyth) - {key(f) for f in d.ours})}")
            for d in c.extra:
                if not _movable_nu(d.ours, d.smyth):
                    out.append(f"- {cell_name(d.cell)}: we also accept {' / '.join(d.ours)}; Smyth prints only {' / '.join(d.smyth)}")
            out += [f"- {cell_name(x)}: Smyth has this cell; we do not" for x in c.missing]
        out.append("")
    out += ["", "## Cells that could not be checked against Smyth", ""]
    if not partial:
        out.append("None.")
    for lemma, src, c in partial:
        unchecked = (c.not_in_smyth + c.unreadable) if isinstance(c, Comparison) else []
        reason = src.note or ""
        if isinstance(c, Comparison) and c.unreadable:
            reason += (" " if reason else "") + "Perseus failed to display a character in: " + ", ".join(cell_name(x) for x in c.unreadable) + "."
        out.append(f"- **{lemma}** ({len(unchecked)} cell{'' if len(unchecked) == 1 else 's'}): {reason}".rstrip())
    out += [
        "",
        "Cells not checked here were still checked twice by machine: Wiktionary's tables (the",
        "source) and the Morpheus analyzer agree on them, and the greek-checker reviewer read them.",
        "",
        "## Next step",
        "",
        "If this is good enough for you, say \"mark the golden files verified\" (or set",
        "`\"verified\": true` yourself in each file in `data/golden/`). From then on the tests fail",
        "if the generated data ever drifts from these tables.",
        "",
    ]
    return "\n".join(out)


def main() -> int:
    results = {}
    for lemma, src in SOURCES.items():
        doc = json.loads((GOLDEN / f"{lemma}.json").read_text(encoding="utf-8"))
        results[lemma] = (src, check(lemma, doc["cells"], src))
    OUT.write_text(render(results), encoding="utf-8")
    statuses = [summarize(c)[0] for _, c in results.values()]
    print(f"{OUT.relative_to(ROOT)}: " + ", ".join(f"{s} {statuses.count(s)}" for s in ("match", "partial", "attention")))
    return 0


if __name__ == "__main__":
    sys.exit(main())
