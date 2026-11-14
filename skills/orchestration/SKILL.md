---
name: orchestration
description: >-
  Coordinate bounded goal loops with Orca workers, review gates, and checked outcomes.
  Use for worker supervision or dispatched worker ask/worker_done reports.
  Use orca-cli for handoffs without a report back and ordinary terminal control.
---

# RA: Orca orchestration

Load the version-matched guide before coordinating or reporting as a worker.
Claude coordinates bounded goal loops; Codex does code and research; Hermes or
Sonnet reviews every task report. The coordinator checks the goal itself.
Never substitute non-Orca subagents for requested Orca workers.

## Resolve the CLI for this session

Choose the executable once and reuse it for every later command:

- If the `ORCA_CLI_COMMAND` environment variable is set, use its value. Orca exports this
  for managed WSL sessions.
- Otherwise, in a dev checkout whose session exposes `ORCA_DEV_REPO_ROOT`, use `orca-dev`.
- Otherwise, on Linux outside an Orca-managed terminal, use `orca-ide`. Never run bare
  `orca` there — outside Orca's terminals it normally resolves to the
  GNOME Orca screen reader (`/usr/bin/orca`) and starts speech on the user's machine.
- Otherwise, use `orca`.

Below, `ORCA` is a placeholder for the executable you resolved. Substitute it before
running anything; do not create a shell variable or run `ORCA` literally. This works the
same way in POSIX shells, PowerShell, and cmd.exe.

If the selected executable cannot run, report its exact error and stop. Do not fall through
to another executable, which could silently target a different Orca build.

## Load the guide

```text
ORCA skills get orchestration
```

Follow Goal, Split, Dispatch, Review gate, Check the goal, Ledger in that order.
Keep `.orca-goals/<name>/goal.md` local and git-ignored; default round cap: 3.
Dispatch independent work, then end your turn. No polling or watch scripts.
Use `send` to reuse a finished worker, including the reviewer. Max 10 live workers.
Workers follow their Task/Dispatch preamble for `ask` and `worker_done`.

### Workers using Hermes profiles

Any coordinator or worker can call `ORCA bots list --json`, then
`ORCA bots ask box:a2z "<bounded task or review brief>" --new --json`.
Continue with `--session <sessionId>` from the reply. Omit `--new` to use the newest chat.
The command waits and returns the reply, `sessionId`, `orcaSessionId`, and `settled`.
On `blocked`, open `ORCA bots open box:a2z --session <sessionId>` for the user's approval.
The calling worker still owes its own `worker_done`; a bot ask creates no Task/Dispatch,
wake-up, review gate, or automatic worker settlement. Do not pass a bot ID to `--agent`.

For rare cases, load only the reference named by the guide:
`ORCA skills get orchestration --reference references/<file>.md`.
Use `--references` to list names; if `--reference` is unsupported, use `--full`.

Use the selected executable's `--help` for commands or flags not covered.
If Orca is not running, run `ORCA open --json` and retry. For
`runtime_access_denied`, request permitted access; do not restart Orca.
If `skills get` is unknown, report the version gap and use `--help` for read-only
discovery. Never invent commands or install hooks/plugins into agent configs.
