# RA: Messaging and gates

Orca coordination mail is part of dispatch. External messages are a hard stop:
ask RA before sending. Reviewers are read-only and cannot approve hard stops.

Handle a whole `check` batch before the next `check`. Run the check named in a
wake, then end your turn when no action remains. No inbox polling or watchers.
A question within the brief can be answered with:

```text
ORCA orchestration reply --id <message_id> --body "<answer>"
```

If an answer would allow a hard stop, ask RA and keep dependent work paused.
An escalation with an approval is a person's permission prompt. Do not approve
it yourself; continue independent work until its closing message arrives.
An escalation with `stopReason` is not `worker_done`; inspect it before acting.

## Review handoff

Send the reviewer the task and Dispatch IDs, goal path, spec, exact changed
files/diff, report, and evidence paths. Require PASS or REJECT with concrete
findings. Include failed task reports and every fix report. The coordinator
handles the reviewer's verdict; reviewers do not recursively review verdicts.

```text
ORCA orchestration send --to dispatch:<reviewer_id> --subject "Review task <task_id>" --body "<review packet>"
ORCA orchestration send --to dispatch:<worker_id> --subject "Fix review findings" --body "<findings and failing criteria>"
```

Run the second command only on rejection, within the round cap. `send` to a
finished or closed local worker creates follow-up work; use the receipt's new
Task/Dispatch IDs for later messages. Keep the old IDs in the goal history.
Review approval is separate from Orca Task settlement. Never relabel a failed
report as success; the coordinator still runs the goal checks itself.

## Groups and lost context

Groups (`@all`, `@idle`, `@codex`, ...) reach live workers of your Run;
`@worktree:<id>` also reaches coordinators there. Use deliberate fan-out only.
In PowerShell, quote group addresses and comma-separated type filters.

For mail already consumed before context loss:
`ORCA orchestration inbox --terminal run:<run_id> --limit 50 --full`.
A worker uses `dispatch:<dispatch_id>` as its mailbox instead.
For paired servers, read [Placement and remote execution](placement-and-remote.md).
