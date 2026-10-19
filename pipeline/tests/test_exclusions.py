"""Greek strings are copied from the kaikki dump (λείπω's perfect table)."""
import pytest

from exclusions import Rule, apply_rules, parse_exclusions

TEXT = """
# comments and blank lines are ignored
λαός                       # whole lemma
λείπω  perf.act            # a block
λείπω  perf.act.ind.3.pl  λέλοιπεν
"""


def test_parse():
    rules = parse_exclusions(TEXT)
    assert [(r.lemma, r.scope, r.form) for r in rules] == [
        ("λαός", None, None),
        ("λείπω", "perf.act", None),
        ("λείπω", "perf.act.ind.3.pl", "λέλοιπεν"),
    ]
    assert rules[0].line == 3


def test_parse_rejects_bad_scope():
    with pytest.raises(ValueError):
        parse_exclusions("λείπω  perf act extra words")


def cells():
    return {
        "perf.act.ind.3.pl": ["λελοίπᾱσῐ", "λελοίπᾱσῐν", "λέλοιπεν"],
        "perf.act.ind.1.sg": ["λέλοιπᾰ"],
        "perf.mp.inf": ["λελεῖφθαι"],
    }


def test_whole_lemma():
    out, effects = apply_rules("λαός", cells(), parse_exclusions("λαός"))
    assert out is None
    assert len(effects) == 1


def test_form_rule_removes_only_that_form():
    rule = parse_exclusions("λείπω  perf.act.ind.3.pl  λέλοιπεν")
    out, effects = apply_rules("λείπω", cells(), rule)
    assert out["perf.act.ind.3.pl"] == ["λελοίπᾱσῐ", "λελοίπᾱσῐν"]
    assert effects[0][1] == "removed 1 form"


def test_block_rule_matches_on_dot_boundary():
    out, _ = apply_rules("λείπω", cells(), parse_exclusions("λείπω  perf.act"))
    assert set(out) == {"perf.mp.inf"}


def test_rules_for_other_lemmas_do_not_apply():
    out, effects = apply_rules("λύω", cells(), parse_exclusions("λείπω  perf.act"))
    assert out == cells() and effects == []


def test_lemma_match_ignores_length_marks():
    rules = [Rule(lemma="λείπω", scope=None, form=None, line=1, text="λείπω")]
    out, _ = apply_rules("λείπω", cells(), rules)
    assert out is None
