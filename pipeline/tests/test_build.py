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
from core_list import read_core_list
from exclusions import parse_exclusions
from normalize import key, strip_length

SCHEMA = json.loads((Path(__file__).parents[1] / "schema.json").read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def index(all_sample_entries):
    return index_entries(all_sample_entries)


@pytest.fixture(scope="module")
def articles(sample_entries):
    return article_forms_from(sample_entries[("ὁ", "article")])


CORE = {r.lemma: r for r in read_core_list()}


def cand(lemma, pos, dcc_pos=None, rank=1):
    row = CORE.get(lemma)
    return Candidate(
        lemma=lemma,
        pos=pos,
        gloss=row.gloss if row else "gloss",
        rank=rank,
        dcc_pos=dcc_pos,
        in_dcc=True,
        headword=row.headword if row else None,
    )


def build(index, articles, lemma, pos, rules=(), **kw):
    c = cand(lemma, pos, **kw)
    entries, dcc_lemma, supplements = select_entry(c, index)
    return build_lemma(c, entries, dcc_lemma, articles, list(rules), supplements)


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
    entries, _, _ = select_entry(cand("οὐδαμῶς", "noun"), index)
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
    assert any("iterative" in n for n in b.choices)


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


# --- table selection guided by the DCC principal parts (data/core_list.csv headwords) ---


def _tables_with(index, word, form_tags, contains):
    """Raw tables of `word` that have a row with `form_tags` whose form is in `contains`."""
    from kaikki import tables
    from normalize import strip_accents

    entry = index[(key(word), "verb")][0]
    want = {strip_accents(f) for f in contains}
    return [t for t in tables(entry) if any(strip_accents(f) in want for f, _ in t.forms)]


def test_dcc_principal_part_selects_the_aorist_passive(index, articles):
    b = build(index, articles, "παύω", "verb")
    c = cells(b)
    (t,) = _tables_with(index, "παύω", None, c["aor.pass.ind.1.sg"])
    assert t.label == "aorist"
    # only one aorist passive: the one DCC lists
    assert len(c["aor.pass.ind.1.sg"]) == 1


def test_future_passive_follows_the_chosen_aorist_passive(index, articles):
    from normalize import strip_all

    c = cells(build(index, articles, "παύω", "verb"))
    aor = strip_all(c["aor.pass.ind.1.sg"][0])
    for fut in c["fut.pass.ind.1.sg"]:
        assert aor[:-2].endswith(strip_all(fut)[: -len("ησομαι")])


def test_middle_future_in_dcc_removes_the_active_future(index, articles):
    c = cells(build(index, articles, "ἀκούω", "verb"))
    assert not [k for k in c if k.startswith("fut.act")]
    assert "fut.mid.ind.1.sg" in c


def test_voices_from_tables_without_a_principal_part_are_dropped(index, articles):
    c = cells(build(index, articles, "τυγχάνω", "verb"))
    assert not [k for k in c if k.startswith("aor.pass")]
    assert not [k for k in c if k.startswith("perf.mp")]


def test_tense_missing_from_dcc_merges_all_attic_tables(index, articles):
    c = cells(build(index, articles, "ἐργάζομαι", "verb"))
    assert len(c["impf.mp.ind.1.sg"]) == 2
    c = cells(build(index, articles, "βούλομαι", "verb"))
    assert len(c["impf.mp.ind.1.sg"]) == 2


def test_no_iterative_forms(index, articles):
    from normalize import strip_all

    for word in ("λαμβάνω", "παύω"):
        for fs in cells(build(index, articles, word, "verb")).values():
            assert not [f for f in fs if "σκ" in strip_all(f)], word


def test_no_separate_passive_in_the_present_system(index, articles):
    c = cells(build(index, articles, "κελεύω", "verb"))
    assert not [k for k in c if k.startswith(("pres.pass", "impf.pass", "perf.pass"))]


def test_sigma_sigma_verb_takes_missing_tenses_from_the_sigma_sigma_entry(index, articles):
    b = build(index, articles, "πράσσω", "verb")
    c = cells(b)
    assert key(b.lemma["lemma"]) == key("πράττω")
    assert "aor.act.ind.1.sg" in c and "fut.act.ind.1.sg" in c
    assert not [f for fs in c.values() for f in fs if "σσ" in f]


def test_perfect_middle_block_may_lack_only_the_periphrastic_third_plural(index, articles):
    rules = parse_exclusions("λύω  perf.mp.ind.3.pl")
    c = cells(build(index, articles, "λύω", "verb", rules=rules))
    assert "perf.mp.ind.1.sg" in c and "perf.mp.ind.3.pl" not in c
    rules = parse_exclusions("λύω  perf.mp.ind.3.sg")
    c = cells(build(index, articles, "λύω", "verb", rules=rules))
    assert not [k for k in c if k.startswith("perf.mp")]  # block and its infinitive dropped


def test_table_exclusion_rule_drops_a_source_table(index, articles):
    first = cells(build(index, articles, "ἐργάζομαι", "verb"))["impf.mp.ind.1.sg"][0]
    rules = parse_exclusions(f"ἐργάζομαι  table  {first}")
    c = cells(build(index, articles, "ἐργάζομαι", "verb", rules=rules))
    assert first not in c["impf.mp.ind.1.sg"] and len(c["impf.mp.ind.1.sg"]) == 1


def test_aorist_passive_principal_part_does_not_remove_the_active(index, articles):
    # DCC's λέγω aorist is the suppletive εἶπον (another entry); its ἐλέχθην must not count as
    # evidence that the aorist is deponent.
    c = cells(build(index, articles, "λέγω", "verb"))
    assert "aor.act.ind.1.sg" in c


def test_alternates_differing_only_in_length_marks_are_merged(index, articles):
    from normalize import strip_length

    for word in ("λύω", "παύω", "πράσσω"):
        for fs in cells(build(index, articles, word, "verb")).values():
            assert len({strip_length(f) for f in fs}) == len(fs), (word, fs)


def test_report_credits_rules_that_exclude_an_attic_substitute(index, articles):
    from build_paradigms import render_report

    rules = parse_exclusions("θάλαττα")
    c = cand("θάλασσα", "noun")
    entries, dcc_lemma, sup = select_entry(c, index)
    result = build_lemma(c, entries, dcc_lemma, articles, rules, sup)
    sources = {"kaikki": {"extracted": "x", "wiktionary_dump": "y"}, "dcc": {"retrieved": "z"}}
    report = render_report([c], {c: result}, sources, rules)
    assert "line 1 `θάλαττα`: removed lemma" in report


# --- second audit -------------------------------------------------------------------------


def test_future_principal_part_does_not_select_a_present_table(index, articles):
    # πίνω's DCC future πίομαι also appears in a second "present" table; the present must
    # still come from the table with the lemma.
    c = cells(build(index, articles, "πίνω", "verb"))
    assert c["pres.mp.ind.1.sg"] != c["fut.mid.ind.1.sg"]


def test_perfect_active_needs_its_own_principal_part_when_dcc_gives_the_middle(index, articles):
    # DCC gives τρέφω only τέθραμμαι and ἐλαύνω's perfect active only as "-ελήλακα" (compound
    # only): the perfect active found next to the middle part is not trusted (third audit).
    for word in ("τρέφω", "ἐλαύνω"):
        c = cells(build(index, articles, word, "verb"))
        assert not [k for k in c if k.startswith("perf.act")], word
        assert "perf.mp.ind.1.sg" in c, word
    assert "perf.act.ind.1.sg" in cells(build(index, articles, "λύω", "verb"))


def test_no_future_passive_without_an_aorist_passive(index, articles):
    c = cells(build(index, articles, "ἔχω", "verb"))
    assert not [k for k in c if k.startswith("aor.pass")]
    assert not [k for k in c if k.startswith("fut.pass")]


def test_sigma_sigma_supplement_can_supply_a_voice_of_a_covered_tense(index, articles):
    c = cells(build(index, articles, "πράσσω", "verb"))
    assert "perf.mp.ind.1.sg" in c and "perf.act.ind.1.sg" in c


def test_every_fallback_choice_is_reported(index, articles):
    b = build(index, articles, "λύω", "verb")
    assert any(n.startswith("impf.act:") for n in b.choices)


def test_dcc_accent_slip_is_resolved_by_gloss(index, articles):
    # DCC writes the ordinal "fifth" as πεμπτός; Wiktionary's πεμπτός means "sent".
    c = cand("πεμπτός", "adj")
    entries, dcc_lemma, _ = select_entry(c, index)
    assert [e["senses"][0]["glosses"][0] for e in entries] == ["fifth"]
    assert dcc_lemma == "πεμπτός"


def test_scan_dump_keeps_entries_that_differ_only_in_accent(tmp_path, all_sample_entries):
    import json

    from build_paradigms import scan_dump

    path = tmp_path / "dump.jsonl"
    path.write_text("\n".join(json.dumps(e, ensure_ascii=False) for e in all_sample_entries), encoding="utf-8")
    index = scan_dump(path, [cand("πεμπτός", "adj")])
    entries, _, _ = select_entry(cand("πεμπτός", "adj"), index)
    assert [e["senses"][0]["glosses"][0] for e in entries] == ["fifth"]
