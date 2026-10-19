# How to start (for you, the human)

## One-time setup (~10 minutes)

1. Install Claude Code if you haven't, and Node 20+ and Python 3.11+.
2. Unzip this folder somewhere and open a terminal in it:
   ```
   cd attic-greek-game
   claude
   ```
3. Inside Claude Code, install the Superpowers plugin:
   ```
   /plugin install superpowers@claude-plugins-official
   ```
   (If that name isn't found: `/plugin marketplace add obra/superpowers-marketplace`, then
   `/plugin install superpowers@superpowers-marketplace`.)
   Restart Claude Code after installing so the skills load.
4. Optional, for a nicer-looking app: install Anthropic's `frontend-design` skill from `/plugin`.

## The kickoff prompt (paste this as your first message)

```
Read CLAUDE.md, docs/PLAN.md and docs/PROGRESS.md.

You are building this project end to end, phase by phase, following docs/PLAN.md exactly.
Start with Phase 0. For each phase: use /superpowers:write-plan, save the plan to
docs/plans/phase-N.md, show me a short summary, then /superpowers:execute-plan.

Stop and ask me at every 🧑 HUMAN GATE. Between gates, keep going without asking unless
you are genuinely blocked. Keep docs/PROGRESS.md current so a new session can resume.
```

## Each later session

```
Read CLAUDE.md and docs/PROGRESS.md, then continue from the first unfinished task in
docs/PLAN.md.
```

## What you'll be asked to do (the human gates)

| When | What you do | Time |
|---|---|---|
| Phase 1 | Answer scope questions; approve docs/SPEC.md | 30 min |
| Phase 2 | Maybe download the kaikki Ancient Greek JSONL and/or the DCC core list if Claude can't fetch them; check ~12 golden paradigms against Smyth or your textbook and flip `"verified": true` | 1–2 hrs |
| Phase 6 | Read the grammar notes and approve them | 30 min |
| Phase 7 | Create the GitHub repo, push, and turn on Pages (Settings → Pages → Source: GitHub Actions) | 10 min |

## Tips

- If a session gets long and Claude starts forgetting things, run `/clear` and use the
  "each later session" prompt. PROGRESS.md is the memory.
- If tests keep failing in a loop, the Stop hook is doing its job. Say "show me the failing
  test and explain it" rather than letting it thrash.
- To audit data at any point: "Run the greek-checker subagent on data/."
