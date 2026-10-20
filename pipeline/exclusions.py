"""Rules from data/exclude.txt that remove doubtful data from the output (never edit it).

Line formats (whitespace separated, `#` starts a comment):
    <lemma>                       drop the whole lemma
    <lemma> <cell-key prefix>     drop every cell whose key is or starts with the prefix + "."
    <lemma> <cell-key> <form>     drop one form from one cell
    <lemma> table <form>          drop every source table that contains <form> (applied by
                                  build_paradigms before cells are chosen)
"""
import re
from dataclasses import dataclass

from normalize import key

_SCOPE = re.compile(r"^[a-z0-9]+(\.[a-z0-9]+)*$")


@dataclass(frozen=True)
class Rule:
    lemma: str
    scope: str | None
    form: str | None
    line: int
    text: str


def parse_exclusions(text: str) -> list[Rule]:
    rules = []
    for n, raw in enumerate(text.splitlines(), start=1):
        body = raw.split("#", 1)[0].strip()
        if not body:
            continue
        parts = body.split()
        if len(parts) > 3 or (len(parts) > 1 and not _SCOPE.match(parts[1])) or (parts[1:2] == ["table"] and len(parts) != 3):
            raise ValueError(f"exclude.txt line {n}: cannot parse {raw!r}")
        scope = parts[1] if len(parts) > 1 else None
        form = key(parts[2]) if len(parts) > 2 else None
        rules.append(Rule(key(parts[0]), scope, form, n, body))
    return rules


def _in_scope(cell_key: str, scope: str) -> bool:
    return cell_key == scope or cell_key.startswith(scope + ".")


def apply_rules(
    lemma: str, cells: dict[str, list[str]], rules: list[Rule]
) -> tuple[dict[str, list[str]] | None, list[tuple[Rule, str]]]:
    """Return the remaining cells (None if the lemma is dropped) and what each rule removed."""
    effects: list[tuple[Rule, str]] = []
    out = {k: list(v) for k, v in cells.items()}
    for rule in rules:
        if rule.lemma != key(lemma) or rule.scope == "table":
            continue
        if rule.scope is None:
            return None, effects + [(rule, "removed lemma")]
        if rule.form is None:
            hit = [k for k in out if _in_scope(k, rule.scope)]
            for k in hit:
                del out[k]
            effects.append((rule, f"removed {len(hit)} cells"))
            continue
        removed = 0
        for k in [k for k in out if k == rule.scope]:
            kept = [f for f in out[k] if key(f) != rule.form]
            removed += len(out[k]) - len(kept)
            if kept:
                out[k] = kept
            else:
                del out[k]
        effects.append((rule, f"removed {removed} form" + ("" if removed == 1 else "s")))
    return out, effects
