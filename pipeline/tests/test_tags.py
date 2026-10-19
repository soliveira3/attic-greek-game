"""Tag lists below are copied from rows of the kaikki dump."""
from tags import Skip, nominal_cells, verb_cells


def test_noun_cell():
    assert nominal_cells(["genitive", "singular"], with_gender=False) == [
        {"key": "gen.sg", "case": "gen", "number": "sg"}
    ]


def test_dual_noun_cell():
    assert nominal_cells(["dual", "nominative"], with_gender=False)[0]["key"] == "nom.du"


def test_adjective_cell_expands_shared_genders():
    cells = nominal_cells(["feminine", "genitive", "masculine", "singular"], with_gender=True)
    assert [c["key"] for c in cells] == ["gen.sg.m", "gen.sg.f"]
    assert cells[0] == {"key": "gen.sg.m", "case": "gen", "number": "sg", "gender": "m"}


def test_adjective_degree_forms_are_skipped():
    assert nominal_cells(["adverbial"], with_gender=True) == Skip("degree")
    assert isinstance(nominal_cells(["comparative", "masculine", "nominative", "singular"], True), Skip)


def test_nominal_without_number_is_a_problem():
    skip = nominal_cells(["genitive"], with_gender=False)
    assert isinstance(skip, Skip) and skip.anomaly


def test_verb_indicative():
    assert verb_cells(["active", "first-person", "indicative", "singular"], "aor") == [
        {"key": "aor.act.ind.1.sg", "tense": "aor", "voice": ["act"], "mood": "ind", "person": "1", "number": "sg"}
    ]


def test_verb_mediopassive_is_one_cell_with_both_voices():
    (cell,) = verb_cells(["indicative", "middle", "passive", "second-person", "singular"], "pres")
    assert cell["key"] == "pres.mp.ind.2.sg"
    assert cell["voice"] == ["mid", "pass"]


def test_verb_dual_with_two_persons_expands():
    cells = verb_cells(["active", "dual", "indicative", "second-person", "third-person"], "pres")
    assert [c["key"] for c in cells] == ["pres.act.ind.2.du", "pres.act.ind.3.du"]


def test_infinitive():
    assert verb_cells(["active", "infinitive"], "pres") == [
        {"key": "pres.act.inf", "tense": "pres", "voice": ["act"], "mood": "inf"}
    ]


def test_infinitive_ignores_spurious_person_number_but_flags_it():
    cells = verb_cells(["dual", "infinitive", "middle", "second-person", "third-person"], "fut")
    assert [c["key"] for c in cells] == ["fut.mid.inf"]
    assert cells.note == "infinitive with person/number tags"


def test_out_of_scope_moods_are_skipped():
    assert verb_cells(["active", "optative", "first-person", "singular"], "pres") == Skip("mood")
    assert verb_cells(["active", "participle", "nominative", "masculine", "singular"], "pres") == Skip("mood")


def test_verb_without_voice_is_a_problem():
    skip = verb_cells(["infinitive", "plural"], "pres")
    assert isinstance(skip, Skip) and skip.anomaly
