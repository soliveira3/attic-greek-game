"""Write app/src/lib/__fixtures__/normalize_parity.json: what pipeline/normalize.py and
betacode.py return for every golden form, so app/src/lib/normalize.ts can be tested against the
same behaviour without typing Greek into the tests.

Usage: python export_parity.py
"""
import json
import sys
from pathlib import Path

from betacode import to_beta
from normalize import final_sigma, key, nfc, strip_accents, strip_all, strip_length

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "app" / "src" / "lib" / "__fixtures__" / "normalize_parity.json"


def parity_rows() -> list[dict]:
    forms: set[str] = set()
    for path in sorted((ROOT / "data" / "golden").glob("*.json")):
        for cell_forms in json.loads(path.read_text(encoding="utf-8"))["cells"].values():
            forms.update(cell_forms)
    return [
        {
            "form": f,
            "nfc": nfc(f),
            "stripLength": strip_length(f),
            "stripAccents": strip_accents(f),
            "stripAll": strip_all(f),
            "key": key(f),
            "finalSigma": final_sigma(f),
            "beta": to_beta(f),
        }
        for f in sorted(forms)
    ]


def render() -> str:
    return json.dumps(parity_rows(), ensure_ascii=False, indent=1) + "\n"


def main() -> int:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(render(), encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
