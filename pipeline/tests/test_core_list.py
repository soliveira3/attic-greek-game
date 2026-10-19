from pathlib import Path

from core_list import CoreRow, parse_dcc_html

FIXTURE = Path(__file__).parent / "fixtures" / "dcc_sample.html"


def rows():
    return {r.lemma: r for r in parse_dcc_html(FIXTURE.read_text(encoding="utf-8"))}


def test_parses_every_row():
    assert len(rows()) == 5


def test_article_row():
    r = rows()["ὁ"]
    assert r == CoreRow(
        lemma="ὁ", pos="article", gloss="the", rank=1, dcc_pos="definite article", headword="ὁ ἡ τό"
    )


def test_noun_lemma_is_first_word_of_headword():
    r = rows()["λόγος"]
    assert r.pos == "noun"
    assert r.dcc_pos == "noun: 2nd declension"
    assert r.headword == "λόγος λόγου, ὁ"


def test_verb_lemma_strips_principal_parts():
    r = rows()["λύω"]
    assert r.pos == "verb"
    assert r.headword.startswith("λύω, λύσω")


def test_adjective_and_uninflected():
    assert rows()["ἀληθής"].pos == "adj"
    assert rows()["καί"].pos == "other"


def test_rank_is_int():
    assert all(isinstance(r.rank, int) for r in rows().values())


def test_read_core_list_round_trips(tmp_path):
    import csv
    from dataclasses import astuple, fields

    from core_list import read_core_list

    original = sorted(rows().values(), key=lambda r: r.rank)
    path = tmp_path / "core.csv"
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow([fl.name for fl in fields(CoreRow)])
        w.writerows(astuple(r) for r in original)
    assert read_core_list(path) == original
