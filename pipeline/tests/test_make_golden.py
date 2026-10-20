import json

from make_golden import golden_doc, render_golden, render_review, write_golden

LEMMA = {
    "id": "λόγος", "lemma": "λόγος", "dccLemma": "λόγος", "pos": "noun", "class": "decl2-mf",
    "gender": ["m"], "gloss": "word", "rank": 45,
    "cells": [
        {"key": "nom.sg", "case": "nom", "number": "sg", "forms": ["λόγος"]},
        {"key": "gen.sg", "case": "gen", "number": "sg", "forms": ["λόγου"]},
    ],
}


def test_golden_doc_is_unverified_and_keyed_by_cell():
    doc = golden_doc(LEMMA)
    assert doc["verified"] is False
    assert doc["lemma"] == "λόγος" and doc["class"] == "decl2-mf"
    assert doc["cells"] == {"nom.sg": ["λόγος"], "gen.sg": ["λόγου"]}


def test_render_golden_round_trips():
    doc = golden_doc(LEMMA)
    assert json.loads(render_golden(doc)) == doc


def test_write_golden_never_overwrites_a_verified_file(tmp_path):
    verified = {**golden_doc(LEMMA), "verified": True, "cells": {"nom.sg": ["λόγος"]}}
    (tmp_path / "λόγος.json").write_text(json.dumps(verified, ensure_ascii=False), encoding="utf-8")
    written, kept = write_golden(tmp_path, [LEMMA])
    assert written == [] and kept == ["λόγος"]
    assert json.loads((tmp_path / "λόγος.json").read_text(encoding="utf-8")) == verified


def test_write_golden_refreshes_unverified_files(tmp_path):
    stale = {**golden_doc(LEMMA), "cells": {}}
    (tmp_path / "λόγος.json").write_text(json.dumps(stale, ensure_ascii=False), encoding="utf-8")
    written, _ = write_golden(tmp_path, [LEMMA])
    assert written == ["λόγος"]
    assert json.loads((tmp_path / "λόγος.json").read_text(encoding="utf-8"))["cells"]["gen.sg"] == ["λόγου"]


def test_review_has_a_grid_per_lemma():
    text = render_review([golden_doc(LEMMA)])
    assert "## λόγος" in text
    assert "| nom | λόγος |" in text.replace("  ", " ")


def test_review_notes_the_periphrastic_perfect_third_plural():
    lemma = {
        "lemma": "λύω", "pos": "verb", "class": "verb-thematic", "verified": False,
        "cells": {f"perf.mp.ind.{p}.{n}": ["x"] for p in "123" for n in ("sg", "pl") if (p, n) != ("3", "pl")},
    }
    assert "periphrasis" in render_review([lemma])
