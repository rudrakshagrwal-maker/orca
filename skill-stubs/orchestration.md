# RA: Orca orchestration

Load the version-matched guide before coordinating or reporting as a worker.
Claude coordinates bounded goal loops; Codex does code and research; Hermes or
Sonnet reviews every task report. The coordinator checks the goal itself.
Never substitute non-Orca subagents for requested Orca workers.

<!-- shared: resolver -->

## Load the guide

```text
ORCA skills get orchestration
```

Follow Goal, Split, Dispatch, Review gate, Check the goal, Ledger in that order.
Keep `.orca-goals/<name>/goal.md` local and git-ignored; default round cap: 3.
Dispatch independent work, then end your turn. No polling or watch scripts.
Use `send` to reuse a finished worker, including the reviewer. Max 10 live workers.
Workers follow their Task/Dispatch preamble for `ask` and `worker_done`.

For rare cases, load only the reference named by the guide:
`ORCA skills get orchestration --reference references/<file>.md`.
Use `--references` to list names; if `--reference` is unsupported, use `--full`.

<!-- shared-omit: no-guessing -->

Use the selected executable's `--help` for commands or flags not covered.
If Orca is not running, run `ORCA open --json` and retry. For
`runtime_access_denied`, request permitted access; do not restart Orca.
If `skills get` is unknown, report the version gap and use `--help` for read-only
discovery. Never invent commands or install hooks/plugins into agent configs.
