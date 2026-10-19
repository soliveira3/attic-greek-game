"""Map Wiktionary form tags to cells of the feature schema (pipeline/schema.json)."""
from dataclasses import dataclass
from itertools import product

CASE = {"nominative": "nom", "genitive": "gen", "dative": "dat", "accusative": "acc", "vocative": "voc"}
NUMBER = {"singular": "sg", "dual": "du", "plural": "pl"}
GENDER = {"masculine": "m", "feminine": "f", "neuter": "n"}
PERSON = {"first-person": "1", "second-person": "2", "third-person": "3"}
VOICE = {"active": "act", "middle": "mid", "passive": "pass"}
OUT_OF_SCOPE_MOODS = frozenset({"subjunctive", "optative", "imperative", "participle"})
DEGREE = frozenset({"comparative", "superlative", "adverbial"})


@dataclass(frozen=True)
class Skip:
    """A form that produces no cell. `anomaly` marks tags we could not make sense of."""

    reason: str
    anomaly: bool = False


class Cells(list):
    """Cells for one form, plus an optional note about a tagging oddity worth reporting."""

    def __init__(self, cells: list[dict], note: str | None = None) -> None:
        super().__init__(cells)
        self.note = note


def _pick(tags: list[str], table: dict[str, str]) -> list[str]:
    return [table[t] for t in table if t in tags]  # table order, not tag order


def nominal_cells(tags: list[str], with_gender: bool) -> Cells | Skip:
    if DEGREE & set(tags):
        return Skip("degree")
    unknown = set(tags) - CASE.keys() - NUMBER.keys() - GENDER.keys()
    if unknown:
        return Skip(f"unknown tags {sorted(unknown)}", anomaly=True)
    cases, numbers, genders = _pick(tags, CASE), _pick(tags, NUMBER), _pick(tags, GENDER)
    if not cases or len(numbers) != 1 or (with_gender and not genders):
        return Skip(f"incomplete tags {sorted(tags)}", anomaly=True)
    number = numbers[0]
    if not with_gender:
        return Cells([{"key": f"{c}.{number}", "case": c, "number": number} for c in cases])
    return Cells(
        [
            {"key": f"{c}.{number}.{g}", "case": c, "number": number, "gender": g}
            for c, g in product(cases, genders)
        ]
    )


def _voice_group(voices: list[str]) -> str | None:
    return {("act",): "act", ("mid",): "mid", ("pass",): "pass", ("mid", "pass"): "mp"}.get(tuple(voices))


def verb_cells(tags: list[str], tense: str) -> Cells | Skip:
    if OUT_OF_SCOPE_MOODS & set(tags):
        return Skip("mood")
    unknown = set(tags) - PERSON.keys() - NUMBER.keys() - VOICE.keys() - {"indicative", "infinitive"}
    if unknown:
        return Skip(f"unknown tags {sorted(unknown)}", anomaly=True)
    voices = _pick(tags, VOICE)
    group = _voice_group(voices)
    if group is None:
        return Skip(f"no usable voice in {sorted(tags)}", anomaly=True)
    persons, numbers = _pick(tags, PERSON), _pick(tags, NUMBER)
    if "infinitive" in tags:
        cell = {"key": f"{tense}.{group}.inf", "tense": tense, "voice": voices, "mood": "inf"}
        note = "infinitive with person/number tags" if persons or numbers else None
        return Cells([cell], note)
    if "indicative" not in tags or not persons or len(numbers) != 1:
        return Skip(f"incomplete tags {sorted(tags)}", anomaly=True)
    number = numbers[0]
    return Cells(
        [
            {
                "key": f"{tense}.{group}.ind.{p}.{number}",
                "tense": tense,
                "voice": voices,
                "mood": "ind",
                "person": p,
                "number": number,
            }
            for p in persons
        ]
    )
