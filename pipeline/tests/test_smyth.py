"""The fixture is the first table of Smyth §216 as served by Perseus (public domain)."""
from pathlib import Path

from normalize import key, strip_all
from smyth import paradigm_columns, parse_tables, smyth_form

FIXTURE = Path(__file__).parent / "fixtures" / "smyth_216_table.html"


def test_smyth_form_drops_quantity_marks_and_morpheme_hyphens():
    assert smyth_form("χώρα_-ν") == key("χώραν")
    assert smyth_form("νί_κη") == key("νίκη")


def test_parse_tables_keeps_rows_and_cells():
    (table,) = parse_tables(FIXTURE.read_text(encoding="utf-8"))
    assert table[0] == ["SINGULAR"]
    assert table[3][1] == "land"


def test_paradigm_columns_maps_cells_by_lemma():
    (table,) = parse_tables(FIXTURE.read_text(encoding="utf-8"))
    cols = paradigm_columns(table)
    chora = cols[smyth_form("χώρα_")]
    assert chora["gen.sg"] == [smyth_form("χώρα_ς")]
    assert chora["acc.sg"] == [smyth_form("χώρα_-ν")]
    # dual rows cover several cases; plural "N. V." covers nominative and vocative
    assert chora["nom.du"] == chora["acc.du"] == chora["voc.du"]
    assert chora["nom.pl"] == chora["voc.pl"]
    assert set(cols) >= {smyth_form("θάλαττα")}


def _smyth_216():
    (table,) = parse_tables(FIXTURE.read_text(encoding="utf-8"))
    return paradigm_columns(table)


def _golden(lemma):
    import json

    path = Path(__file__).resolve().parents[2] / "data" / "golden" / f"{lemma}.json"
    return json.loads(path.read_text(encoding="utf-8"))["cells"]


def test_compare_direct_on_the_real_golden_file():
    from smyth import compare

    result = compare(_golden("χώρα"), _smyth_216()[smyth_form("χώρα_")])
    assert result.ok == sorted(_smyth_216()[smyth_form("χώρα_")])
    assert not result.differs


def test_compare_reports_a_differing_cell():
    from smyth import compare

    ours = dict(_golden("χώρα"))
    ours["gen.sg"] = ours["dat.sg"]
    result = compare(ours, _smyth_216()[smyth_form("χώρα_")])
    assert [d.cell for d in result.differs] == ["gen.sg"]


def test_shape_compares_endings_and_accent_by_analogy():
    from smyth import shape

    # φυγή (Smyth §216) and τιμή (golden) share endings and accent pattern
    assert shape("φυγῆς", 3) == shape("τῑμῆς", 3)
    assert shape("φυγή", 3) == shape("τῑμή", 3)
    assert shape("φυγῆς", 3) != shape("φυγής", 3)


def _section(n):
    from smyth import section_columns

    page = (Path(__file__).parent / "fixtures" / f"smyth_{n}_tables.html").read_text(encoding="utf-8")
    return section_columns(parse_tables(page))


def test_section_columns_carry_the_header_into_later_tables_and_drop_parentheses():
    # §268: the dual table has no header row and shows uncontracted forms in parentheses
    polis = _section(268)[smyth_form("πόλις")]
    assert polis["nom.du"] == [smyth_form("πόλει")]
    assert polis["gen.pl"] == [smyth_form("πόλε-ων")]


def test_blank_header_subcolumns_belong_to_the_word_on_their_left():
    # §264: each word has an uncontracted (parenthesised) and a contracted column
    genos = _section(264)[smyth_form("γένος")]
    assert genos["nom.pl"] == [smyth_form("γένη")]
    assert genos["gen.du"] == [smyth_form("γενοῖν")]


def _tables(n):
    page = (Path(__file__).parent / "fixtures" / f"smyth_{n}_tables.html").read_text(encoding="utf-8")
    return parse_tables(page)


def test_section_forms_expand_movable_nu_and_skip_parentheses():
    from smyth import section_forms

    forms = section_forms(_tables(292), stem=strip_all("ἀληθ"))
    assert smyth_form("ἀληθέσι") in forms and smyth_form("ἀληθέσιν") in forms
    assert smyth_form("ἀληθέ-ος") not in forms  # uncontracted, in parentheses


def test_compare_forms_on_the_real_golden_article():
    from smyth import compare_forms, section_forms

    golden = _golden("ὁ")
    result = compare_forms(golden, section_forms(_tables(332), stem=""))
    assert result.only_smyth == []
    assert result.only_ours == []


def test_verb_columns_on_smyth_383():
    from smyth import verb_columns

    cells = verb_columns(_tables(383), voices=["act", "act", "mid", "mid", "pass"])
    assert cells["pres.act.ind.1.sg"] == [smyth_form("λύ_ω")]
    assert cells["impf.act.ind.3.du"] == [smyth_form("ἐλυ_έτην")]
    assert cells["pres.mp.ind.2.sg"] == [smyth_form("λύ_ῃ"), smyth_form("λύ_ει")]
    assert cells["aor.mid.inf"] == [smyth_form("λύ_σασθαι")]
    assert cells["aor.pass.ind.1.sg"] == [smyth_form("ἐλύθην")]
    assert cells["fut.pass.inf"] == [smyth_form("λυθήσεσθαι")]
    assert not [k for k in cells if k.startswith("plup") or ".ind." not in k and not k.endswith(".inf")]


def test_verb_columns_take_the_voice_from_column_headers():
    from smyth import verb_columns

    cells = verb_columns(_tables(384), voices=["act"])
    assert cells["aor.mid.ind.1.sg"] == [smyth_form("ἐλιπόμην")]
    assert cells["perf.act.ind.1.sg"] == [smyth_form("λέλοιπα")]


def test_golden_lyo_agrees_with_smyth_383():
    from smyth import compare, verb_columns

    result = compare(_golden("λύω"), verb_columns(_tables(383), voices=["act", "act", "mid", "mid", "pass"]))
    assert not result.differs, result.differs


def test_unrendered_character_marks_the_cell_unreadable():
    from smyth import UNREADABLE, compare

    neanias = _section(222)[smyth_form("νεα_νία_ς")]
    assert neanias["dat.sg"] == [UNREADABLE]
    result = compare(_golden("νεανίας"), neanias)
    assert result.unreadable == ["dat.sg"] and not result.differs


def test_extra_empty_cells_do_not_shift_columns():
    geron = _section(257)[smyth_form("γέρων")]
    assert set(geron["dat.pl"]) == {smyth_form("γέρουσι"), smyth_form("γέρουσιν")}


def test_case_label_followed_by_a_parenthesised_form():
    basileus = _section(275)[smyth_form("βασιλεύ-ς")]
    assert basileus["dat.sg"] == [smyth_form("βασιλεῖ")]


def test_a_stray_greek_row_after_data_rows_is_not_a_header():
    basileus = _section(275)[smyth_form("βασιλεύ-ς")]
    assert basileus["gen.pl"] == [smyth_form("βασιλέ-ων")]
    assert "nom.pl" not in basileus  # the garbled row stays unreadable rather than wrong
