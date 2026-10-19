"""Parse the DCC Greek Core Vocabulary page into data/core_list.csv.

Usage: python core_list.py            (reads raw/dcc-greek-core.html, fetching it if missing)
"""
import csv
import html
import re
import sys
import urllib.request
from dataclasses import astuple, dataclass, fields
from pathlib import Path

from normalize import nfc

URL = "https://dcc.dickinson.edu/greek-core-list"
ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "pipeline" / "raw" / "dcc-greek-core.html"
OUT = ROOT / "data" / "core_list.csv"


@dataclass(frozen=True)
class CoreRow:
    lemma: str
    pos: str
    gloss: str
    rank: int
    dcc_pos: str
    headword: str


def _pos(dcc_pos: str) -> str:
    if dcc_pos == "definite article":
        return "article"
    for prefix, pos in (("noun", "noun"), ("adjective", "adj"), ("verb", "verb")):
        if dcc_pos.startswith(prefix):
            return pos
    return "other"


def _text(cell: str) -> str:
    return nfc(re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", cell))).strip())


def parse_dcc_html(page: str) -> list[CoreRow]:
    body = page[page.find("<tbody") :]
    out = []
    for row in re.findall(r"<tr>(.*?)</tr>", body, re.S):
        cells = [_text(c) for c in re.findall(r"<td[^>]*>(.*?)</td>", row, re.S)]
        if len(cells) != 5:
            continue
        headword, gloss, dcc_pos, _group, rank = cells
        lemma = re.split(r"[\s,]+", headword)[0]
        out.append(CoreRow(lemma, _pos(dcc_pos), gloss, int(rank), dcc_pos, headword))
    return out


def read_core_list(path: Path = OUT) -> list[CoreRow]:
    with path.open(encoding="utf-8", newline="") as f:
        return [
            CoreRow(r["lemma"], r["pos"], r["gloss"], int(r["rank"]), r["dcc_pos"], r["headword"])
            for r in csv.DictReader(f)
        ]


def main() -> int:
    if not RAW.exists():
        RAW.parent.mkdir(parents=True, exist_ok=True)
        with urllib.request.urlopen(URL, timeout=60) as resp:
            RAW.write_bytes(resp.read())
    rows = parse_dcc_html(RAW.read_text(encoding="utf-8"))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow([fl.name for fl in fields(CoreRow)])
        w.writerows(astuple(r) for r in sorted(rows, key=lambda r: r.rank))
    print(f"wrote {len(rows)} rows to {OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
