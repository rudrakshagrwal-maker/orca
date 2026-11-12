---
name: orchestration
description: >-
  Coordinate bounded goal loops with Orca workers, review gates, and checked outcomes.
  Use for worker supervision or dispatched worker ask/worker_done reports.
  Use orca-cli for handoffs without a report back and ordinary terminal control.
---

# RA: Orca orchestration

Claude coordinates. Codex does code and research. Hermes or Sonnet reviews.
`ORCA` means the executable that served this guide; use it for every command.
A worker follows its Task/Dispatch preamble: `ask`, end the turn, report with `worker_done`.

## 1. Goal

Before dispatch, write `.orca-goals/<name>/goal.md` in the workspace.
In a Git workspace, first ensure `.orca-goals/` is ignored by the project's
ignore rules and verify with `git check-ignore .orca-goals/<name>/goal.md`.
Folder workspaces need no Git setup. Keep goal files local and untracked.
Use this shape, replacing each criterion with an exact check:

```text
Outcome: <observable result>
Done:
- [ ] <command> exits 0
- [ ] <file> exists and contains <required result>
- [ ] <measured number> meets <threshold>
Hard stops: deploy, push to main, external messages, money, deletes: ask RA.
Round: 1; cap: 3
Ledger: <existing session ledger path>
```

The cap is 3 unless RA sets another. One dispatch/review/check cycle is one round.
Record results and evidence paths in this file.

## 2. Split

Split only independent work. Each spec names the target, change, allowed files,
constraints, evidence of done, goal path, and hard stops. Evidence files must also be disjoint.
Two workers never share files. Sequence overlapping work after the earlier
worker settles. Reviewers read files; they send fixes back instead of editing.

## 3. Dispatch

For a new goal: `ORCA orchestration run-create --objective "<goal>"`.
Reuse a finished worker with `send` before starting another:

```text
ORCA orchestration send --to dispatch:<worker_id> --subject "Next task" --body "<self-contained spec>"
ORCA orchestration worker-start --spec "<self-contained spec>" --worktree current --agent codex
```

Run the appropriate command, not both. Start independent tasks, then end your
turn. No polling, watch scripts, or terminal steering. Orca wakes you.
Start from the coordinator's Orca session: each worker gets its own linked tab.
Follow the receipt's `next`, including link repair.
On a failed start, do not repeat it; load the recovery reference.

## 4. Review gate

Send every task `worker_done`, including failures and fix reports, to a
read-only reviewer before accepting it. Reuse the reviewer with `send`.
If none exists, start one with the goal, task spec, report, diff, and evidence:

```text
ORCA orchestration worker-start --spec "<read-only review spec; PASS or REJECT with evidence>" --worktree current --agent hermes
```

Sonnet alternative: `--agent claude --model <installed_sonnet_model_id>`.
Use an enabled reviewer; if neither is available, report a blocked review.
Then end your turn. A reviewer verdict returns to the coordinator as a gate
decision. PASS permits goal checks. REJECT goes back to the same task worker:

```text
ORCA orchestration send --to dispatch:<worker_id> --subject "Fix review findings" --body "<findings, failing criteria, allowed files, evidence required>"
```

Batch rejections into the next round; never start a fix beyond the cap.
`worker_done` settles an Orca Task; it does not mean coordinator acceptance.

## 5. Check the goal

The coordinator runs every done-criterion itself, including browser checks.
Record commands, exit codes, files, and numbers in `goal.md`; claims or PASS cannot replace checks.
All pass: mark the goal DONE in the file, report to RA per task (outcome,
evidence, blockers), and close settled owned workers with
`ORCA orchestration worker-release --dispatch <dispatch_id>`; follow `next`.
Any fail, including review rejection: record the failures, advance the round,
and send only the failing criteria back through split, dispatch, and review.
Rerun all goal checks after fixes. At the cap, stop dispatching, report what
remains and why, and release settled idle workers. Never claim success early.
There is no goal-complete CLI command; the checked goal file records closure.

## 6. Ledger

After acceptance, append one line per landed task to the existing session ledger:
`HH:MM · STATE · <task>: <outcome>; evidence <path>; blockers <none or reason>`.
Use local time; default ledger: `.orca-goals/<name>/ledger.md`.

## House rules

- Servers, builds, and long commands run in the background, never as tabs. Tabs are for agents.
- Max 10 live workers, including reviewers. Reuse finished workers; close settled idle ones.
- Never type into or close a terminal you did not start. Trace a process or commit to your own worker first.
- Codex on this laptop cannot launch Playwright/Chromium. The coordinator owns browser checks.
- Windows: pass Windows paths (`C:\...`) to Codex `-C` and `--add-dir`.
- No tracking or phone-home. Never write hooks/plugins into any agent config. Status uses OSC 7501 only.
- Ask RA before hard stops. Orca coordination mail is allowed; messages outside this workflow need approval.

## Wakes and rare cases

Run `check` only when a wake names it; handle the whole batch. Answer within scope:
`ORCA orchestration reply --id <message_id> --body "<answer>"`.
Load `ORCA skills get orchestration --reference references/<file>.md` as needed:
`coordinator-loop.md` for DAGs; `placement-and-remote.md` for worktrees/servers;
`messaging-and-gates.md` for mail; `recovery-and-cleanup.md` for unknown workers;
`low-level-topology.md` for custom tabs. Never treat silence as proof of exit.
