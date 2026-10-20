"""Cross-check every generated form against Morpheus and record disagreements in REPORT.md.

Usage: python crosscheck_morpheus.py

Needs the native library and stemlib in pipeline/raw/morpheus (see fetch_morpheus.sh). Nothing is
fixed automatically: disagreements are listed in REPORT.md and in data/paradigms/morpheus.json.
Each one must then be either removed through data/exclude.txt or explained in
data/morpheus_reviewed.txt; a data test enforces this.
"""
import fnmatch
import json
import re
import sys
from collections import Counter, defaultdict
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

from betacode import to_beta
from normalize import key

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "pipeline" / "raw" / "morpheus"
LIBRARY = RAW / "libmorpheus-0.3.2-Linux-x86_64-glibc" / "lib" / "libmorpheus.so"
STEMLIB = RAW / "stemlib"
PARADIGMS = ROOT / "data" / "paradigms"
REPORT = PARADIGMS / "REPORT.md"
DISAGREEMENTS = PARADIGMS / "morpheus.json"
START, END = "<!-- morpheus:start -->", "<!-- morpheus:end -->"

_CASE = {"nominative": "nom", "genitive": "gen", "dative": "dat", "accusative": "acc", "vocative": "voc"}
_NUMBER = {"singular": "sg", "dual": "du", "plural": "pl"}
_GENDER = {"masculine": "m", "feminine": "f", "neuter": "n"}
_TENSE = {"present": "pres", "imperfect": "impf", "future": "fut", "aorist": "aor", "perfect": "perf"}
_MOOD = {"indicative": "ind", "infinitive": "inf"}
_PERSON = {"first": "1", "second": "2", "third": "3"}
_VOICE = {"active": ("act",), "middle": ("mid",), "passive": ("pass",), "medio-passive": ("mid", "pass")}
_POS = {"noun": ("noun",), "adj": ("adjective",), "article": ("article",), "verb": ("verb",)}


@dataclass(frozen=True)
class MorphParse:
    """One Morpheus analysis, in the project's feature keys."""

    lemma: str
    pos: str
    cases: tuple[str, ...]
    number: str | None
    genders: tuple[str, ...]
    tense: str | None
    mood: str | None
    voices: tuple[str, ...]
    person: str | None

    @classmethod
    def from_analysis(cls, a: object) -> "MorphParse":
        g = lambda name: getattr(a, name)  # noqa: E731
        voices: tuple[str, ...] = ()
        for v in g("voices"):
            voices += _VOICE.get(v, ())
        return cls(
            lemma=g("lemma"),
            pos=g("part_of_speech"),
            cases=tuple(_CASE[c] for c in g("grammatical_cases") if c in _CASE),
            number=_NUMBER.get(g("grammatical_number") or ""),
            genders=tuple(_GENDER[x] for x in g("genders") if x in _GENDER),
            tense=_TENSE.get(g("tense") or ""),
            mood=_MOOD.get(g("mood") or ""),
            voices=voices,
            person=_PERSON.get(g("person") or ""),
        )


Analyze = Callable[[str], list[MorphParse]]


class Morpheus:
    def __init__(self, library: Path, stemlib: Path) -> None:
        from libmorpheus import Language, Library

        self._lib = Library(str(library))
        self._ctx = self._lib.context(str(stemlib), Language.GREEK)
        self._cache: dict[str, list[MorphParse]] = {}

    @classmethod
    def default(cls) -> "Morpheus":
        return cls(LIBRARY, STEMLIB)

    def analyze(self, beta: str) -> list[MorphParse]:
        if beta not in self._cache:
            self._cache[beta] = [MorphParse.from_analysis(a) for a in self._ctx.analyze(beta)]
        return self._cache[beta]

    def __enter__(self) -> "Morpheus":
        return self

    def __exit__(self, *_: object) -> None:
        self._ctx.close()
        self._lib.close()


def _bare_lemma(beta: str) -> str:
    """Morpheus lemma without homograph digits, hyphens, accents or iota subscript."""
    return re.sub(r"[0-9\-/\\=_^|]", "", beta)


def lemma_keys(lemma: dict) -> set[str]:
    names = {lemma["lemma"]} | ({lemma["dccLemma"]} if lemma.get("dccLemma") else set())
    return {to_beta(n) for n in names} | {_bare_lemma(to_beta(n)) for n in names}


def _compatible(cell: dict, pos: str, p: MorphParse) -> bool:
    if p.pos not in _POS[pos]:
        return False
    if "tense" in cell:
        if p.tense != cell["tense"] or p.mood != cell["mood"] or not set(cell["voice"]) & set(p.voices):
            return False
        return cell["mood"] == "inf" or (p.person == cell["person"] and p.number == cell["number"])
    if cell["case"] not in p.cases or p.number != cell["number"]:
        return False
    return "gender" not in cell or not p.genders or cell["gender"] in p.genders


def _describe(p: MorphParse) -> str:
    bits = [p.pos, "/".join(p.cases), p.tense or "", p.mood or "", "/".join(p.voices), p.person or "", p.number or "", "/".join(p.genders)]
    return " ".join(b for b in bits if b)


def check_form(form: str, cell: dict, lemma: dict, analyze: Analyze) -> tuple[str, str]:
    """("ok" | "unknown" | "other lemma" | "features", detail)."""
    parses = analyze(to_beta(form))
    if not parses:
        return "unknown", ""
    keys = lemma_keys(lemma)
    mine = [p for p in parses if p.lemma in keys or _bare_lemma(p.lemma) in keys]
    if not mine:
        return "other lemma", ", ".join(sorted({p.lemma for p in parses}))
    if any(_compatible(cell, lemma["pos"], p) for p in mine):
        return "ok", ""
    return "features", "; ".join(sorted({_describe(p) for p in mine}))


Result = tuple[str, str, str, str, str]  # lemma, cell key, form, kind, detail


def render_section(results: list[Result], provenance: str) -> str:
    kinds = Counter(r[3] for r in results)
    lemmas = sorted({r[0] for r in results})
    out = [
        START,
        "## Morpheus cross-check",
        "",
        f"Checked {len(results)} forms of {len(lemmas)} lemmas with {provenance}: "
        f"{kinds['ok']} agree, {kinds['features']} feature mismatches, {kinds['other lemma']} parsed as another lemma, "
        f"{kinds['unknown']} not recognised.",
        "",
        "Morpheus does not know every lemma or alternate, so *not recognised* is weak evidence. "
        "A *feature mismatch* (Morpheus knows the lemma but parses the form differently) is the strongest signal.",
        "",
        "### Feature mismatches",
        "",
    ]
    rows = [f"- {lem} `{k}` {f} — Morpheus: {d}" for lem, k, f, kind, d in results if kind == "features"]
    out += rows or ["(none)"]
    out += ["", "### Parsed as another lemma", ""]
    rows = [f"- {lem} `{k}` {f} — Morpheus lemma: {d}" for lem, k, f, kind, d in results if kind == "other lemma"]
    out += rows or ["(none)"]
    out += ["", "### Not recognised, by lemma", ""]
    by_lemma: dict[str, list[str]] = defaultdict(list)
    totals = Counter(r[0] for r in results)
    for lem, k, f, kind, _ in results:
        if kind == "unknown":
            by_lemma[lem].append(f"{f} `{k}`")
    rows = [
        f"- {lem}: {len(items)}/{totals[lem]}" + (" (Morpheus seems not to know this lemma)" if len(items) == totals[lem] else ": " + ", ".join(items))
        for lem, items in sorted(by_lemma.items())
    ]
    out += rows or ["(none)"]
    out += ["", END]
    return "\n".join(out) + "\n"


def run(analyze: Analyze) -> list[Result]:
    results: list[Result] = []
    for name in ("nouns.json", "adjectives.json", "verbs.json"):
        for lemma in json.loads((PARADIGMS / name).read_text(encoding="utf-8"))["lemmas"]:
            for cell in lemma["cells"]:
                for form in cell["forms"]:
                    kind, detail = check_form(form, cell, lemma, analyze)
                    results.append((lemma["lemma"], cell["key"], form, kind, detail))
    return results


def disagreements(results: list[Result]) -> list[dict]:
    """Every non-agreeing result, sorted, in the shape stored in data/paradigms/morpheus.json."""
    rows = [
        {"lemma": lem, "key": k, "form": f, "kind": kind, "detail": detail}
        for lem, k, f, kind, detail in results
        if kind != "ok"
    ]
    return sorted(rows, key=lambda r: (r["lemma"], r["key"], r["form"]))


@dataclass(frozen=True)
class Reviewed:
    """A line of data/morpheus_reviewed.txt: `<lemma|*> <cell-key glob> [<form>]  # reason`."""

    lemma: str
    key_glob: str
    form: str | None
    reason: str


def parse_reviewed(text: str) -> list[Reviewed]:
    out = []
    for n, line in enumerate(text.splitlines(), start=1):
        body, _, comment = line.partition("#")
        parts = body.split()
        if not parts:
            continue
        if len(parts) not in (2, 3) or not comment.strip():
            raise ValueError(f"morpheus_reviewed.txt line {n}: need lemma, key glob, optional form and a # reason")
        out.append(Reviewed(parts[0], parts[1], parts[2] if len(parts) == 3 else None, comment.strip()))
    return out


def reviewed_reason(item: dict, patterns: list[Reviewed]) -> str | None:
    for p in patterns:
        if p.lemma != "*" and key(p.lemma) != key(item["lemma"]):
            continue
        if not fnmatch.fnmatchcase(item["key"], p.key_glob):
            continue
        if p.form is not None and key(p.form) != key(item["form"]):
            continue
        return p.reason
    return None


def write_section(section: str) -> None:
    report = REPORT.read_text(encoding="utf-8")
    if START in report and END in report:
        report = report[: report.index(START)] + section + report[report.index(END) + len(END) :].lstrip("\n")
    else:
        report = report.rstrip("\n") + "\n\n" + section
    REPORT.write_text(report, encoding="utf-8")


def main() -> int:
    if not LIBRARY.exists() or not STEMLIB.exists():
        print("Morpheus not found; run pipeline/fetch_morpheus.sh first", file=sys.stderr)
        return 1
    sources = json.loads((ROOT / "pipeline" / "sources.json").read_text(encoding="utf-8"))["morpheus"]
    with Morpheus.default() as m:
        results = run(m.analyze)
    write_section(render_section(results, f"{sources['native']}, {sources['stemlib']}"))
    DISAGREEMENTS.write_text(json.dumps(disagreements(results), ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    kinds = Counter(r[3] for r in results)
    print(f"{len(results)} forms: " + ", ".join(f"{k} {v}" for k, v in kinds.most_common()))
    return 0


if __name__ == "__main__":
    sys.exit(main())
