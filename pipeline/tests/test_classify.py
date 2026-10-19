"""Nominative/genitive pairs below are copied from the kaikki dump."""
import pytest

from classify import aorist_types, classify_adj, classify_noun, classify_verb
from tags import Skip

FIRST, SECOND, THIRD = "First declension", "Second declension", "Third declension"


@pytest.mark.parametrize(
    "decl, nom, gen, genders, expected",
    [
        (FIRST, "χώρᾱ", "χώρᾱς", ["f"], "decl1-a-long"),
        (FIRST, "ἡμέρᾱ", "ἡμέρᾱς", ["f"], "decl1-a-long"),
        (FIRST, "θᾰ́λᾰττᾰ", "θᾰλᾰ́ττης", ["f"], "decl1-a-short"),
        (FIRST, "δόξᾰ", "δόξης", ["f"], "decl1-a-short"),
        (FIRST, "τῑμή", "τῑμῆς", ["f"], "decl1-eta"),
        (FIRST, "πολῑ́της", "πολῑ́του", ["m"], "decl1-masc-es"),
        (FIRST, "νεᾱνῐ́ᾱς", "νεᾱνῐ́ου", ["m"], "decl1-masc-as"),
        (SECOND, "λόγος", "λόγου", ["m"], "decl2-mf"),
        (SECOND, "δῶρον", "δώρου", ["n"], "decl2-n"),
        (THIRD, "φλέψ", "φλεβός", ["f"], "decl3-labial"),
        (THIRD, "φῠ́λᾰξ", "φῠ́λᾰκος", ["m", "f"], "decl3-velar"),
        (THIRD, "ἐλπῐ́ς", "ἐλπῐ́δος", ["f"], "decl3-dental"),
        (THIRD, "σῶμᾰ", "σώμᾰτος", ["n"], "decl3-dental"),
        (THIRD, "γέρων", "γέροντος", ["m"], "decl3-nt"),
        (THIRD, "ᾰ̓γών", "ᾰ̓γῶνος", ["m"], "decl3-liquid"),
        (THIRD, "γένος", "γένους", ["n"], "decl3-s"),
        (THIRD, "πόλῐς", "πόλεως", ["f"], "decl3-i"),
        (THIRD, "ᾰ̓́στῠ", "ᾰ̓́στεως", ["n"], "decl3-u"),
        (THIRD, "βᾰσῐλεύς", "βᾰσῐλέως", ["m"], "decl3-eu"),
    ],
)
def test_classify_noun(decl, nom, gen, genders, expected):
    assert classify_noun(decl, nom, gen, genders, dcc_pos=None) == expected


def test_contracted_second_declension_is_out_of_scope():
    assert isinstance(classify_noun(SECOND, "νοῦς", "νοῦ", ["m"], None), Skip)


def test_dcc_irregular_is_out_of_scope():
    result = classify_noun(THIRD, "ᾰ̓νήρ", "ᾰ̓νδρός", ["m"], "noun: 3rd declension irregular")
    assert isinstance(result, Skip)


def adj(m, f, n, gen_m):
    return {"nom.sg.m": [m], "nom.sg.f": [f], "nom.sg.n": [n], "gen.sg.m": [gen_m]}


def test_classify_adj():
    assert classify_adj("First and second declension", adj("ᾰ̓γᾰθός", "ᾰ̓γᾰθή", "ᾰ̓γᾰθόν", "ᾰ̓γᾰθοῦ")) == "adj-212-eta"
    assert classify_adj("First and second declension", adj("ᾰ̓́ξῐος", "ᾰ̓ξῐ́ᾱ", "ᾰ̓́ξῐον", "ᾰ̓ξῐ́ου")) == "adj-212-alpha"
    assert classify_adj("Second declension", adj("ᾰ̓́δῐκος", "ᾰ̓́δῐκος", "ᾰ̓́δῐκον", "ᾰ̓δῐ́κου")) == "adj-22"
    assert classify_adj("Third declension", adj("ᾰ̓ληθής", "ᾰ̓ληθής", "ᾰ̓ληθές", "ᾰ̓ληθοῦς")) == "adj-3-es"
    assert classify_adj("Third declension", adj("σώφρων", "σώφρων", "σῶφρον", "σώφρονος")) == "adj-3-on"


def test_participle_like_adjective_is_out_of_scope():
    assert isinstance(classify_adj("Third declension", adj("γέρων", "γέρων", "γέρον", "γέροντος")), Skip)


def test_three_one_three_adjective_is_out_of_scope():
    assert isinstance(classify_adj(None, adj("τᾰχῠ́ς", "τᾰχεῖᾰ", "τᾰχῠ́", "τᾰχέος")), Skip)


def test_classify_verb():
    assert classify_verb("λύω") == "verb-thematic"
    assert classify_verb("μάχομαι") == "verb-thematic"
    assert isinstance(classify_verb("εἰμί"), Skip)


def test_aorist_types():
    assert aorist_types({"aor.act.ind.1.sg": ["ἔλῡσᾰ"]}) == (["1"], False)
    assert aorist_types({"aor.act.ind.1.sg": ["ἔλῐπον"]}) == (["2"], False)
    assert aorist_types({}) == ([], False)
