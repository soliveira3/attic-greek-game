"""End-to-end tests of build_paradigms on real kaikki entries (tests/fixtures)."""
import json
from pathlib import Path

import jsonschema
import pytest

from build_paradigms import (
    Candidate,
    Rejected,
    article_forms_from,
    build_lemma,
    index_entries,
    render_json,
    select_entry,
)
from exclusions import parse_exclusions
from normalize import key, strip_length

SCHEMA = json.loads((Path(__file__).parents[1] / "schema.json").read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def index(sample_entries):
    return index_entries(sample_entries.values())


@pytest.fixture(scope="module")
def articles(sample_entries):
    return article_forms_from(sample_entries[("ὁ", "article")])


def cand(lemma, pos, dcc_pos=None, rank=1):
    return Candidate(lemma=lemma, pos=pos, gloss="gloss", rank=rank, dcc_pos=dcc_pos, in_dcc=True)


def build(index, articles, lemma, pos, rules=(), **kw):
    c = cand(lemma, pos, **kw)
    entries, dcc_lemma = select_entry(c, index)
    return build_lemma(c, entries, dcc_lemma, articles, list(rules))


def cells(built):
    return {c["key"]: c["forms"] for c in built.lemma["cells"]}


def test_noun(index, articles):
    b = build(index, articles, "λόγος", "noun", dcc_pos="noun: 2nd declension")
    assert b.lemma["class"] == "decl2-mf"
    assert b.lemma["gender"] == ["m"]
    keys = list(cells(b))
    assert len(keys) == 15  # 5 cases x sg, du, pl
    assert keys[:5] == ["nom.sg", "gen.sg", "dat.sg", "acc.sg", "voc.sg"]


def test_article_prefix_is_stripped(index, articles):
    b = build(index, articles, "φύλαξ", "noun")
    assert b.lemma["class"] == "decl3-velar"
    assert b.lemma["gender"] == ["m", "f"]
    assert all(" " not in f for fs in cells(b).values() for f in fs)
    assert b.notes["article stripped from form"] > 0


def test_movable_nu_alternates_are_kept(index, articles):
    b = build(index, articles, "φύλαξ", "noun")
    assert len(cells(b)["dat.pl"]) == 2


def test_attic_substitution(index, articles):
    b = build(index, articles, "θάλασσα", "noun", dcc_pos="noun: 1st declension")
    assert key(b.lemma["lemma"]) == key("θάλαττα")
    assert b.lemma["dccLemma"] == "θάλασσα"
    assert b.lemma["class"] == "decl1-a-short"


def test_adjective(index, articles):
    b = build(index, articles, "ἀγαθός", "adj")
    assert b.lemma["class"] == "adj-212-eta"
    assert len(cells(b)) == 45


def test_two_ending_adjective_has_feminine_cells(index, articles):
    b = build(index, articles, "ἄδικος", "adj")
    c = cells(b)
    assert b.lemma["class"] == "adj-22"
    assert c["gen.pl.f"] == c["gen.pl.m"]


def test_article_has_no_vocative(index, articles):
    b = build(index, articles, "ὁ", "article")
    assert b.lemma["class"] == "article"
    assert not [k for k in cells(b) if k.startswith("voc")]


def test_verb_blocks(index, articles):
    b = build(index, articles, "λύω", "verb")
    assert b.lemma["class"] == "verb-thematic"
    assert b.lemma["aoristType"] == ["1"]
    blocks = {k.rsplit(".ind.", 1)[0] for k in cells(b) if ".ind." in k}
    assert blocks == {
        "pres.act", "pres.mp", "impf.act", "impf.mp", "fut.act", "fut.mid", "fut.pass",
        "aor.act", "aor.mid", "aor.pass", "perf.act", "perf.mp",
    }
    assert "pres.act.inf" in cells(b)


def test_second_aorist(index, articles):
    assert build(index, articles, "λείπω", "verb").lemma["aoristType"] == ["2"]


def test_attic_contracted_future_is_used(index, articles):
    b = build(index, articles, "μάχομαι", "verb")
    fut = cells(b)["fut.mid.ind.1.sg"]
    raw = [
        f for f, tags in _table_forms(index, "μάχομαι", "Attic contracted future")
        if {"first-person", "singular", "indicative"} <= set(tags)
    ]
    assert fut == raw


def _table_forms(index, word, label):
    from kaikki import tables

    (entry,) = index[(key(word), "verb")]
    (t,) = [t for t in tables(entry) if t.label == label]
    return t.forms


def test_exclusion_rule_applies(index, articles):
    rules = parse_exclusions("λείπω  perf.act")
    b = build(index, articles, "λείπω", "verb", rules=rules)
    assert not [k for k in cells(b) if k.startswith("perf.act")]
    assert b.exclusions


def test_whole_lemma_exclusion(index, articles):
    r = build(index, articles, "λόγος", "noun", rules=parse_exclusions("λόγος"))
    assert isinstance(r, Rejected) and r.reason == "excluded"


def test_incomplete_noun_is_rejected(index, articles):
    rules = parse_exclusions("λόγος  gen.pl")
    r = build(index, articles, "λόγος", "noun", rules=rules)
    assert isinstance(r, Rejected) and "gen.pl" in r.detail


def test_incomplete_verb_block_is_dropped_not_the_verb(index, articles):
    rules = parse_exclusions("λύω  aor.pass.ind.3.pl")
    b = build(index, articles, "λύω", "verb", rules=rules)
    assert not [k for k in cells(b) if k.startswith("aor.pass.ind")]
    assert "aor.pass" in b.dropped_blocks


def test_irregular_dcc_noun_is_rejected(index, articles):
    r = build(index, articles, "λόγος", "noun", dcc_pos="noun: 3rd declension irregular")
    assert isinstance(r, Rejected) and r.reason == "out of scope"


def test_missing_entry(index):
    entries, _ = select_entry(cand("οὐδαμῶς", "noun"), index)
    assert entries == []


def test_forms_are_nfc_and_greek_only(index, articles):
    for word, pos in [("λύω", "verb"), ("φύλαξ", "noun"), ("ἀληθής", "adj")]:
        b = build(index, articles, word, pos)
        for fs in cells(b).values():
            for f in fs:
                assert strip_length(f) == strip_length(f.strip())
                assert all("Ͱ" <= ch <= "Ͽ" or "ἀ" <= ch <= "῿" or "̀" <= ch <= "ͯ" for ch in f)


def test_render_json_validates_against_schema(index, articles):
    lemmas = [
        build(index, articles, w, p).lemma
        for w, p in [("λόγος", "noun"), ("ἀγαθός", "adj"), ("ὁ", "article"), ("λύω", "verb")]
    ]
    doc = json.loads(render_json(lemmas, {"kaikki": "k", "wiktionary": "w", "dcc": "d"}))
    jsonschema.validate(doc, SCHEMA)


def test_homograph_entries_are_ordered_by_gloss_overlap():
    from build_paradigms import order_by_gloss

    rush = {"senses": [{"glosses": ["to rush in; to storm; to rage"]}]}
    sacrifice = {"senses": [{"glosses": ["to offer in sacrifice; to slay"]}]}
    assert order_by_gloss("sacrifice", [rush, sacrifice]) == [sacrifice, rush]
    assert order_by_gloss(None, [rush, sacrifice]) == [rush, sacrifice]
    assert order_by_gloss("unrelated", [rush, sacrifice]) == [rush, sacrifice]


def _first_table_forms(index, word, pos, label, tags):
    from kaikki import tables

    entry = index[(key(word), pos)][0]
    t = next(t for t in tables(entry) if t.label == label)
    return [f for f, tg in t.forms if set(tags) <= set(tg)]


def test_later_same_tense_table_does_not_add_alternates(index, articles):
    # λαμβάνω has a second "aorist" table of iterative forms; it must not leak in.
    b = build(index, articles, "λαμβάνω", "verb")
    first = _first_table_forms(index, "λαμβάνω", "verb", "aorist", ["active", "indicative", "first-person", "singular"])
    assert cells(b)["aor.act.ind.1.sg"] == first
    assert "λαμβάνω aorist" in " ".join(b.partial_tables)


def test_later_same_tense_table_fills_missing_voice(index, articles):
    # ἄγω's first aorist table has no passive; the second one supplies it.
    b = build(index, articles, "ἄγω", "verb")
    first = _first_table_forms(index, "ἄγω", "verb", "aorist", ["active", "indicative", "first-person", "singular"])
    assert cells(b)["aor.act.ind.1.sg"] == first
    assert "aor.pass.ind.1.sg" in cells(b)


def test_nominal_uses_first_table_only(index, articles):
    b = build(index, articles, "ἕτερος", "adj")
    first = _first_table_forms(index, "ἕτερος", "adj", "Attic declension-2", ["neuter", "nominative", "singular"])
    assert cells(b)["nom.sg.n"] == first


def test_adjective_with_two_ending_feminine_alternate(index, articles):
    assert build(index, articles, "ἴδιος", "adj").lemma["class"] == "adj-212-alpha"


@pytest.mark.parametrize("word", ["οἷος", "δεύτερος"])
def test_adjective_candidates_match_det_and_num_entries(index, articles, word):
    assert build(index, articles, word, "adj").lemma["class"].startswith("adj-212")


def test_middle_only_tags_in_present_system_become_middle_passive(index, articles):
    # Wiktionary tags ἔρχομαι's present "middle" only; SPEC §2: one form is both middle and passive.
    b = build(index, articles, "ἔρχομαι", "verb")
    keys = list(cells(b))
    assert "pres.mp.ind.1.sg" in keys
    assert not [k for k in keys if k.startswith(("pres.mid", "impf.mid", "perf.mid"))]
    assert [k for k in keys if k.startswith("fut.mid.")]  # the future middle is its own form
    (cell,) = [c for c in b.lemma["cells"] if c["key"] == "pres.mp.ind.1.sg"]
    assert cell["voice"] == ["mid", "pass"]
