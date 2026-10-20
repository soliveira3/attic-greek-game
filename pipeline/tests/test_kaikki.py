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


def test_pick_tables_keeps_attic_and_plain_tables_of_a_tense(sample_entries):
    ts = tables(sample_entries[("μάχομαι", "verb")])
    picked = pick_tables(ts, "verb")
    fut = [t.label for t in picked.kept if t.tense == "fut"]
    # "Attic future" holds the uncontracted partner of "Attic contracted future"; the choice
    # among the rest is made per voice from the DCC principal parts (build_paradigms).
    assert fut == ["future", "future", "Attic contracted future"]
    assert picked.superseded == ["Attic future"]


def test_pick_tables_skips_out_of_scope_tenses(sample_entries):
    picked = pick_tables(tables(sample_entries[("λύω", "verb")]), "verb")
    assert {t.tense for t in picked.kept} == {"pres", "impf", "fut", "aor", "perf"}
    assert {"pluperfect", "future perfect"} <= set(picked.out_of_scope)


def _labels(*labels):
    from kaikki import Table

    return [Table(label=label) for label in labels]


def test_contracted_table_supersedes_only_its_uncontracted_partner():
    # γιγνώσκω: an independent future, then an uncontracted/contracted pair.
    ts = _labels("future", "future", "contracted future")
    picked = pick_tables(ts, "verb")
    assert picked.kept == [ts[0], ts[2]] and picked.kept[0] is ts[0]
    assert picked.superseded == ["future"]


def test_contracted_table_before_plain_keeps_both():
    picked = pick_tables(_labels("contracted present", "present"), "verb")
    assert [t.label for t in picked.kept] == ["contracted present", "present"]


def test_label_modifiers_do_not_hide_the_tense():
    picked = pick_tables(_labels("future imperfective", "Attic intransitive perfect"), "verb")
    assert [t.tense for t in picked.kept] == ["fut", "perf"]
