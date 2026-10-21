from pathlib import Path

from normalize import nfc
from review_sample import _golden_ids, cell_label, load_lemmas, render_markdown, sample

ROOT = Path(__file__).resolve().parents[2]


def lemmas():
    return load_lemmas(ROOT / "data")


def test_same_seed_same_sample_other_seed_other_sample():
    assert sample(lemmas(), 40, seed=1) == sample(lemmas(), 40, seed=1)
    assert sample(lemmas(), 40, seed=1) != sample(lemmas(), 40, seed=2)


def test_every_sampled_form_is_in_the_data_exactly():
    by_ref = {(lem["pos"], lem["id"]): lem for lem in lemmas()}
    for item in sample(lemmas(), 60, seed=3):
        cells = {c["key"]: c for c in by_ref[(item["pos"], item["id"])]["cells"]}
        assert item["forms"] == cells[item["cell"]]["forms"]
        assert all(f == nfc(f) for f in item["forms"])


def test_no_duplicates_no_duals_no_verified_models():
    golden = {nfc(p.stem) for p in (ROOT / "data" / "golden").glob("*.json")}
    items = sample(lemmas(), 80, seed=4)
    assert len({(i["pos"], i["id"], i["cell"]) for i in items}) == len(items) == 80
    assert all(".du" not in f".{i['cell']}." and not i["cell"].endswith(".du") for i in items)
    assert not {nfc(i["id"]) for i in items} & golden


def test_spread_over_the_parts_of_speech_in_proportion():
    items = sample(lemmas(), 40, seed=5)
    counts = {pos: sum(1 for i in items if i["pos"] == pos) for pos in ("noun", "adj", "verb")}
    assert all(n >= 8 for n in counts.values()), counts


def test_cell_labels_are_plain_english():
    assert cell_label({"case": "gen", "number": "pl"}) == "genitive plural"
    assert cell_label({"case": "acc", "number": "sg", "gender": "f"}) == "accusative singular feminine"
    verb = {"tense": "aor", "voice": ["mid"], "mood": "ind", "person": "3", "number": "pl"}
    assert cell_label(verb) == "aorist middle indicative 3rd plural"
    inf = {"tense": "perf", "voice": ["mid", "pass"], "mood": "inf"}
    assert cell_label(inf) == "perfect middle/passive infinitive"


def test_markdown_lists_each_item_with_a_place_to_mark_it():
    items = sample(lemmas(), 5, seed=6)
    text = render_markdown(items, seed=6)
    assert "seed 6" in text
    rows = [line for line in text.splitlines() if line.startswith("| ") and line[2:3].isdigit()]
    assert len(rows) == 5
    for item, row in zip(items, rows):
        assert " / ".join(item["forms"]) in row and item["lemma"] in row and row.rstrip().endswith("|  |")
        assert f"| {item['gloss'].split(';')[0]} |" in row


def test_the_committed_sample_is_the_scripts_output():
    text = (ROOT / "docs" / "REVIEW_SAMPLE.md").read_text(encoding="utf-8")
    assert text == render_markdown(sample(lemmas(), 40, seed=1), seed=1)


def test_only_verified_golden_models_are_left_out(tmp_path):
    (tmp_path / "golden").mkdir()
    (tmp_path / "golden" / "a.json").write_text('{"verified": true}', encoding="utf-8")
    (tmp_path / "golden" / "b.json").write_text('{"verified": false}', encoding="utf-8")
    assert _golden_ids(tmp_path) == {"a"}
