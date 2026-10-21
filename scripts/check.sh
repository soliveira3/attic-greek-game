#!/usr/bin/env bash
# Runs every test suite that exists yet. Used by CI and by the Claude Code Stop hook.
# Usage: bash scripts/check.sh          (CI: exit 1 on failure)
#        bash scripts/check.sh --hook   (Stop hook: exit 2 on failure so Claude keeps working)
# Each suite logs to its own file; a failing suite's output is printed under its name
# (all of it on GitHub Actions, in a collapsible group; the last 60 lines otherwise).

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
LOGS="$(mktemp -d)"
REPORT="$LOGS/report"

# run_suite NAME DIR COMMAND... — runs COMMAND in DIR, records NAME and its output on failure.
run_suite() {
  local name="$1" dir="$2" log="$LOGS/${#FAILED[@]}-$RANDOM.log"
  shift 2
  if ! (cd "$dir" && "$@") >"$log" 2>&1; then
    FAILED+=("$name")
    {
      if [ -n "${GITHUB_ACTIONS:-}" ]; then
        echo "::group::Output of $name"
        cat "$log"
        echo "::endgroup::"
        echo "::error title=$name failed::$(tail -n 5 "$log" | tr '\n' ' ')"
      else
        echo "===== $name: last 60 lines ====="
        tail -n 60 "$log"
      fi
    } >>"$REPORT"
  fi
}

if [ -d "$ROOT/pipeline/tests" ]; then
  PY="$ROOT/pipeline/.venv/bin/python"
  [ -x "$PY" ] || PY="python3"
  run_suite "pipeline (pytest)" "$ROOT/pipeline" "$PY" -m pytest -q
fi

if [ -f "$ROOT/app/package.json" ] && [ -d "$ROOT/app/node_modules" ]; then
  run_suite "app (vitest)" "$ROOT/app" npm run coverage --silent
  run_suite "app (typecheck)" "$ROOT/app" npx --no-install tsc -b
  # Browser smoke test on the built site (needs `npx playwright install chromium`; SKIP_E2E=1 skips).
  if [ "${SKIP_E2E:-}" != 1 ] && [ -d "$ROOT/app/node_modules/@playwright/test" ]; then
    run_suite "app (playwright)" "$ROOT/app" npx --no-install playwright test --reporter=line
  fi
fi

if [ ${#FAILED[@]} -eq 0 ]; then
  rm -rf "$LOGS"
  exit 0
fi

{
  echo "Tests failing: ${FAILED[*]}"
  echo "Fix these before finishing."
  cat "$REPORT"
} >&2
rm -rf "$LOGS"

[ "$HOOK" = 1 ] && exit 2
exit 1
