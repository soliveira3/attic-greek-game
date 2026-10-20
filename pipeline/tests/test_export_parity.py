from export_parity import OUT, render


def test_parity_fixture_is_up_to_date():
    """Rerun `python export_parity.py` when normalize.py, betacode.py or the golden set change."""
    assert OUT.read_text(encoding="utf-8") == render()
