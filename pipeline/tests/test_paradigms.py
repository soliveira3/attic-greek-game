"""Checks on the committed data in data/paradigms and data/golden (run in CI, no dump needed)."""
import json
import re
import unicodedata
from pathlib import Path

import jsonschema
import pytest

ROOT = Path(__file__).resolve().parents[2]
PARADIGMS = ROOT / "data" / "paradigms"
GOLDEN = ROOT / "data" / "golden"
SCHEMA = json.loads((ROOT / "pipeline" / "schema.json").read_text(encoding="utf-8"))
FILES = ["nouns.json", "adjectives.json", "verbs.json"]


def load(name):
    return json.loads((PARADIGMS / name).read_text(encoding="utf-8"))


def all_lemmas():
    return [lem for name in FILES for lem in load(name)["lemmas"]]


@pytest.mark.parametrize("name", FILES)
def test_paradigm_file_matches_schema(name):
    jsonschema.validate(load(name), SCHEMA)


@pytest.mark.parametrize("name", FILES)
def test_ids_and_cell_keys_are_unique(name):
    lemmas = load(name)["lemmas"]
    assert len({lem["id"] for lem in lemmas}) == len(lemmas)
    for lem in lemmas:
        keys = [c["key"] for c in lem["cells"]]
        assert len(set(keys)) == len(keys), lem["id"]


def test_cell_keys_agree_with_their_features():
    for lem in all_lemmas():
        for c in lem["cells"]:
            if lem["pos"] == "verb":
                group = "mp" if c["voice"] == ["mid", "pass"] else c["voice"][0]
                expected = f"{c['tense']}.{group}." + (
                    "inf" if c["mood"] == "inf" else f"ind.{c['person']}.{c['number']}"
                )
            else:
                expected = f"{c['case']}.{c['number']}" + (f".{c['gender']}" if "gender" in c else "")
            assert c["key"] == expected, (lem["id"], c)


def test_forms_are_nfc_with_correct_sigmas():
    for lem in all_lemmas():
        for c in lem["cells"]:
            for f in c["forms"]:
                assert unicodedata.is_normalized("NFC", f), (lem["id"], f)
                assert not re.search(r"ς(?=\w)", f), (lem["id"], f)
                assert not f.endswith("σ"), (lem["id"], f)


def test_every_v1_class_has_at_least_one_lemma():
    classes = {lem["class"] for lem in all_lemmas()}
    defs = SCHEMA["$defs"]
    for group in ("nounClass", "adjClass", "verbClass"):
        assert set(defs[group]["enum"]) <= classes, set(defs[group]["enum"]) - classes


def golden_files():
    return sorted(GOLDEN.glob("*.json"))


@pytest.mark.parametrize("path", golden_files(), ids=lambda p: p.stem)
def test_golden_file_shape(path):
    doc = json.loads(path.read_text(encoding="utf-8"))
    assert isinstance(doc["verified"], bool)
    assert {"lemma", "pos", "class", "cells"} <= doc.keys()


VERIFIED = [p for p in golden_files() if json.loads(p.read_text(encoding="utf-8"))["verified"] is True]


@pytest.mark.parametrize("path", VERIFIED, ids=lambda p: p.stem)
def test_verified_golden_matches_generated_data_exactly(path):
    doc = json.loads(path.read_text(encoding="utf-8"))
    generated = {(lem["lemma"], lem["pos"]): lem for lem in all_lemmas()}
    lem = generated[(doc["lemma"], doc["pos"])]
    assert lem["class"] == doc["class"]
    assert {c["key"]: c["forms"] for c in lem["cells"]} == doc["cells"]
