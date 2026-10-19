import pytest

from kaikki import parse_label, pick_tables, tables


@pytest.mark.parametrize(
    "label, kept, words",
    [
        ("Attic declension-2", True, ["declension-2"]),
        ("Epic declension-2", False, ["declension-2"]),
        ("present", True, ["present"]),
        ("Attic future", True, ["future"]),
        ("Epic aorist", False, ["aorist"]),
        ("Attic Epic perfect", True, ["perfect"]),
        ("Old-Attic declension-3", False, ["declension-3"]),
        ("Koine aorist", False, ["aorist"]),
        ("contracted present", True, ["contracted", "present"]),
        ("Epic Lyric-Ancient-Greek aorist", False, ["aorist"]),
    ],
)
def test_parse_label(label, kept, words):
    lab = parse_label(label)
    assert lab.attic is kept
    assert lab.words == words


def test_tables_groups_forms_under_their_label(sample_entries):
    ts = tables(sample_entries[("λόγος", "noun")])
    assert [t.label for t in ts] == ["Attic declension-2"]
    # 5 cases x 3 numbers, nothing else (no romanization, template or class rows)
    assert len(ts[0].forms) == 15
    assert ts[0].declension_class == "Second declension"


def test_tables_skip_head_and_template_rows(sample_entries):
    for t in tables(sample_entries[("λύω", "verb")]):
        for _form, tags in t.forms:
            assert not {"romanization", "inflection-template", "table-tags", "class", "canonical"} & set(tags)


def test_pick_tables_drops_non_attic(sample_entries):
    picked = pick_tables(tables(sample_entries[("θάλασσα", "noun")]), "noun")
    assert [t.label for t in picked.kept] == ["Attic declension-1"]
    assert sorted(picked.dropped_dialect) == ["Epic declension-1", "Ionic declension-1", "Laconian declension-1"]


def test_pick_tables_prefers_attic_labelled_tense(sample_entries):
    ts = tables(sample_entries[("μάχομαι", "verb")])
    labels = [t.label for t in ts]
    assert "future" in labels and "Attic future" in labels
    picked = pick_tables(ts, "verb")
    fut = [t.label for t in picked.kept if t.tense == "fut"]
    # "Attic future" holds the uncontracted forms; the contracted table is the Attic paradigm.
    assert fut == ["Attic contracted future"]
    assert sorted(picked.superseded) == ["Attic future", "future", "future"]


def test_pick_tables_skips_out_of_scope_tenses(sample_entries):
    picked = pick_tables(tables(sample_entries[("λύω", "verb")]), "verb")
    assert {t.tense for t in picked.kept} == {"pres", "impf", "fut", "aor", "perf"}
    assert {"pluperfect", "future perfect"} <= set(picked.out_of_scope)
