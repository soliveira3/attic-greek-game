import json
from pathlib import Path

import pytest

from normalize import key

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture(scope="session")
def sample_entries():
    """Real kaikki entries (see fixtures/kaikki_sample.jsonl), keyed by (word, pos)."""
    out = {}
    with (FIXTURES / "kaikki_sample.jsonl").open(encoding="utf-8") as f:
        for line in f:
            e = json.loads(line)
            out[(key(e["word"]), e["pos"])] = e
    return out
