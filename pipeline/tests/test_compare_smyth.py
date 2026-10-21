import pytest

from compare_smyth import CACHE, summarize
from smyth import Comparison, Diff, FormComparison


def test_summary_of_a_full_match():
    assert summarize(Comparison(ok=["nom.sg", "gen.sg"])) == ("match", "all 2 cells match")


def test_movable_nu_extras_count_as_a_match():
    # a cell where we also accept the spelling with movable ν (forms copied from golden λύω)
    c = Comparison(ok=["pres.act.ind.1.sg"], extra=[Diff("pres.act.ind.3.pl", ("λῡ́ουσῐ", "λῡ́ουσῐν"), ("λύουσι",))])
    status, text = summarize(c)
    assert status == "match"
    assert "movable" in text


def test_differences_need_attention():
    c = Comparison(ok=["nom.sg"], differs=[Diff("gen.sg", ("x",), ("y",))])
    assert summarize(c)[0] == "attention"


def test_unchecked_cells_are_reported():
    c = Comparison(ok=["nom.sg"], not_in_smyth=["nom.pl"])
    status, text = summarize(c)
    assert status == "partial" and "1 cell" in text


def test_form_comparison_summary():
    assert summarize(FormComparison(both=["a", "b"])) == ("match", "all 2 spellings appear in Smyth")
    assert summarize(FormComparison(both=["a"], only_ours=[("b", ["nom.sg"])]))[0] == "attention"


# needs the Smyth pages cached by compare_smyth.py (git-ignored); never downloads in a test run
@pytest.mark.skipif(not CACHE.exists(), reason="Smyth pages not cached (python compare_smyth.py fetches them)")
def test_leipo_regular_tenses_are_checked_by_pattern_with_lyo():
    import json
    from pathlib import Path

    from compare_smyth import SOURCES, check

    cells = json.loads((Path(__file__).resolve().parents[2] / "data" / "golden" / "λείπω.json").read_text(encoding="utf-8"))["cells"]
    c = check("λείπω", cells, SOURCES["λείπω"])
    assert "pres.act.ind.1.sg" in c.ok and "fut.pass.ind.3.pl" in c.ok
    assert not c.differs
    assert summarize(c)[0] == "partial"


def test_movable_nu_extra_detected_in_pattern_comparisons():
    # λείπω's 3rd plural with and without movable ν against λύω's single form
    c = Comparison(extra=[Diff("pres.act.ind.3.pl", ("λείπουσῐ", "λείπουσῐν"), ("λύουσι",))])
    assert summarize(c)[0] == "match"
