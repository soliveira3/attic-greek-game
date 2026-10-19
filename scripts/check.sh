#!/usr/bin/env bash
# Runs every test suite that exists yet. Used by CI and by the Claude Code Stop hook.
# Usage: bash scripts/check.sh          (CI: exit 1 on failure)
#        bash scripts/check.sh --hook   (Stop hook: exit 2 on failure so Claude keeps working)

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOOK=0
[ "${1:-}" = "--hook" ] && HOOK=1

if [ "$HOOK" = 1 ]; then
  # Avoid an endless loop: if Claude is already continuing because of this hook, let it stop.
  INPUT="$(cat || true)"
  if echo "$INPUT" | grep -q '"stop_hook_active"[[:space:]]*:[[:space:]]*true'; then
    exit 0
  fi
fi

FAILED=()
LOG="$(mktemp)"

if [ -d "$ROOT/pipeline/tests" ]; then
  PY="$ROOT/pipeline/.venv/bin/python"
  [ -x "$PY" ] || PY="python3"
  if ! (cd "$ROOT/pipeline" && "$PY" -m pytest -q) >>"$LOG" 2>&1; then
    FAILED+=("pipeline (pytest)")
  fi
fi

if [ -f "$ROOT/app/package.json" ] && [ -d "$ROOT/app/node_modules" ]; then
  if ! (cd "$ROOT/app" && npm test --silent -- --run) >>"$LOG" 2>&1; then
    FAILED+=("app (vitest)")
  fi
  if ! (cd "$ROOT/app" && npx --no-install tsc -b) >>"$LOG" 2>&1; then
    FAILED+=("app (typecheck)")
  fi
fi

if [ ${#FAILED[@]} -eq 0 ]; then
  rm -f "$LOG"
  exit 0
fi

{
  echo "Tests failing: ${FAILED[*]}"
  echo "Fix these before finishing. Last 60 lines of output:"
  tail -n 60 "$LOG"
} >&2
rm -f "$LOG"

[ "$HOOK" = 1 ] && exit 2
exit 1
