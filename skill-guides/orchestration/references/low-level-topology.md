# RA: Low-level topology

Use `worker-start` for the normal loop. Use custom topology only when needed;
workers still get separate tabs linked to the coordinator. Tabs are for agents,
never background servers, builds, long commands, or watch scripts.

```text
ORCA terminal create --worktree active --title <task_name> --command "<agent_command>" --json
ORCA orchestration dispatch --task <task_id> --to <handle> --inject
```

Use an enabled Codex launch for task work, Hermes or Sonnet for review. Only
adopt an agent terminal you started. Before dispatch, link it with
`ORCA terminal set-parent --terminal <child> --parent <coordinator> --json`.
Never type into or close a terminal someone else started.

To supervise your own existing agent through the usual lifecycle:

```text
ORCA orchestration worker-start --task <task_id> --terminal <handle> --worktree <its_workspace> --json
```

Use its exact workspace. Omit `--agent`, `--model`, and creation flags when
reusing a terminal. Inspect the receipt, then end your turn. Do not add terminal
wait loops; Orca wakes the coordinator with reports. A low-level `dispatch` is
unsupervised and never grants ownership of an unrelated terminal or process.
