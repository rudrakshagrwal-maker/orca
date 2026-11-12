# RA: Coordinator loop reference

The main guide's goal, review, round cap, and ledger rules apply to DAGs too.
A DAG is for unavoidable dependencies, not a second scheduling loop.

## Task DAGs

A Task needs a Run, so create one first. Give concurrent workers disjoint files.
Sequence tasks that need the same files. Separate worktrees do not waive review
or make overlapping changes independent.

```text
ORCA orchestration run-create --objective "<goal>"
ORCA orchestration task-create --spec "<self-contained dependent work>" --deps <json_array>
ORCA orchestration task-list --ready --brief
ORCA orchestration worker-start --task <task_id> --worktree current --agent codex
```

On a wake, inspect ready Tasks once. Dispatch only those whose prerequisites
passed review and whose work fits the remaining goal rounds. Orca dependency
readiness alone is not review approval. Leave room for a reviewer within the
10 live worker limit, then end your turn. Never poll for ready work.

## Several Runs

A later `run-create` keeps earlier Runs and their mail still wakes you.
Commands without `--run` use the newest Run; pass `--run <id>` for earlier work.
`run-use` keeps only the Run it names. Keep each goal's Run and Dispatch IDs in
its goal file. Never change Run bindings merely to evade a failed goal or cap.

A Run is a namespace and inbox. There is no goal-complete command. Record DONE
in `goal.md` only after reviewer approval and coordinator checks, then release
settled owned workers. Do not use `reset` as goal completion or cleanup.
