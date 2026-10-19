"""Cross-check logic. Forms and Morpheus outputs below are copied from real runs (see the
probe in docs/plans/phase-2.md): e.g. Morpheus parses lo/gou as genitive singular of lo/gos."""
from pathlib import Path

import pytest

from crosscheck_morpheus import MorphParse, check_form, lemma_keys, render_section

NOUN = {"lemma": "λόγος", "dccLemma": "λόγος", "pos": "noun"}
GEN_SG = {"key": "gen.sg", "case": "gen", "number": "sg", "forms": ["λόγου"]}


def parse(**kw):
    base = dict(lemma="lo/gos", pos="noun", cases=("gen",), number="sg", genders=("m",),
                tense=None, mood=None, voices=(), person=None)
    return MorphParse(**{**base, **kw})


def test_agreeing_parse():
    assert check_form("λόγου", GEN_SG, NOUN, lambda b: [parse()]) == ("ok", "")


def test_unknown_form():
    assert check_form("λόγου", GEN_SG, NOUN, lambda b: [])[0] == "unknown"


def test_other_lemma():
    kind, detail = check_form("λόγου", GEN_SG, NOUN, lambda b: [parse(lemma="logo/w", pos="verb")])
    assert kind == "other lemma" and "logo/w" in detail


def test_feature_mismatch_lists_morpheus_parses():
    kind, detail = check_form("λόγου", GEN_SG, NOUN, lambda b: [parse(cases=("nom",))])
    assert kind == "features"
    assert "nom" in detail


def test_lemma_homograph_number_and_accent_are_ignored():
    assert "lo/gos" in lemma_keys(NOUN)
    assert check_form("λόγου", GEN_SG, NOUN, lambda b: [parse(lemma="lo/gos2")])[0] == "ok"


def test_dcc_lemma_is_accepted_for_attic_substitutions():
    lemma = {"lemma": "θάλαττα", "dccLemma": "θάλασσα", "pos": "noun"}
    cell = {"key": "gen.sg", "case": "gen", "number": "sg", "forms": ["θᾰλᾰ́ττης"]}
    assert check_form("θᾰλᾰ́ττης", cell, lemma, lambda b: [parse(lemma="qa/lassa", cases=("gen",))])[0] == "ok"


VERB = {"lemma": "λύω", "dccLemma": "λύω", "pos": "verb"}


def vparse(**kw):
    base = dict(lemma="lu/w", pos="verb", cases=(), number="sg", genders=(), tense="pres",
                mood="ind", voices=("mid", "pass"), person="1")
    return MorphParse(**{**base, **kw})


def test_verb_middle_passive_matches_medio_passive():
    cell = {"key": "pres.mp.ind.1.sg", "tense": "pres", "voice": ["mid", "pass"], "mood": "ind",
            "person": "1", "number": "sg", "forms": ["λῡ́ομαι"]}
    assert check_form("λῡ́ομαι", cell, VERB, lambda b: [vparse()])[0] == "ok"


def test_verb_person_mismatch():
    cell = {"key": "perf.act.ind.3.pl", "tense": "perf", "voice": ["act"], "mood": "ind",
            "person": "3", "number": "pl", "forms": ["λέλοιπεν"]}
    lemma = {"lemma": "λείπω", "dccLemma": "λείπω", "pos": "verb"}
    morph = [vparse(lemma="lei/pw", tense="perf", voices=("act",), person="3", number="sg")]
    assert check_form("λέλοιπεν", cell, lemma, lambda b: morph)[0] == "features"


def test_infinitive():
    cell = {"key": "pres.act.inf", "tense": "pres", "voice": ["act"], "mood": "inf", "forms": ["λῡ́ειν"]}
    morph = [vparse(mood="inf", voices=("act",), person=None, number=None)]
    assert check_form("λῡ́ειν", cell, VERB, lambda b: morph)[0] == "ok"


def test_adjective_gender():
    lemma = {"lemma": "ἀγαθός", "dccLemma": "ἀγαθός", "pos": "adj"}
    cell = {"key": "gen.sg.f", "case": "gen", "number": "sg", "gender": "f", "forms": ["ᾰ̓γᾰθῆς"]}
    good = [parse(lemma="a)gaqo/s", pos="adjective", genders=("f",))]
    bad = [parse(lemma="a)gaqo/s", pos="adjective", genders=("m",))]
    assert check_form("ᾰ̓γᾰθῆς", cell, lemma, lambda b: good)[0] == "ok"
    assert check_form("ᾰ̓γᾰθῆς", cell, lemma, lambda b: bad)[0] == "features"


def test_render_section_has_markers_and_counts():
    results = [("λόγος", "gen.sg", "λόγου", "ok", ""), ("λόγος", "gen.pl", "λόγων", "unknown", "")]
    text = render_section(results, "test")
    assert text.startswith("<!-- morpheus:start -->") and text.rstrip().endswith("<!-- morpheus:end -->")
    assert "1 agree" in text and "1 not recognised" in text


MORPHEUS = Path(__file__).resolve().parents[1] / "raw" / "morpheus"


@pytest.mark.skipif(not MORPHEUS.exists(), reason="native Morpheus not installed (pipeline/fetch_morpheus.sh)")
def test_real_morpheus():
    from crosscheck_morpheus import Morpheus

    with Morpheus.default() as m:
        assert check_form("λόγου", GEN_SG, NOUN, m.analyze)[0] == "ok"


def test_morpheus_parse_without_gender_does_not_fail_gender_check():
    # Morpheus gives comparatives (κρείττων) no gender.
    lemma = {"lemma": "ἀγαθός", "dccLemma": "ἀγαθός", "pos": "adj"}
    cell = {"key": "gen.sg.f", "case": "gen", "number": "sg", "gender": "f", "forms": ["ᾰ̓γᾰθῆς"]}
    genderless = [parse(lemma="a)gaqo/s", pos="adjective", genders=())]
    assert check_form("ᾰ̓γᾰθῆς", cell, lemma, lambda b: genderless)[0] == "ok"
