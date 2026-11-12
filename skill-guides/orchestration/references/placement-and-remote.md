# RA: Placement and remote execution

The main guide's goal, review gate, round cap, ownership rules, and 10 live
worker limit apply on every host. Workers do code and research with Codex;
Hermes or Sonnet reviews. Start from the coordinator so each worker's tab is
linked to it. Never install hooks/plugins into agent configs to make this work.

Folder workspaces are valid. `new-child` and `new-top-level` make Git worktrees,
never in a folder project; never `git init` a user's folder. From a multi-repo
folder workspace, `new-child` nests under the folder and needs `--repo` naming
the Git repo to create the worktree in.

Local `current`, `new-child` and `new-top-level` stay in the caller's project;
`new-child` also uses the caller's workspace as its parent. Omit `--repo` for
same-project work. Pass it only to deliberately target another project, or for
the connected-server creation described below. The project visible in the app
is not the caller's project. For direct `worktree create`, likewise omit
`--repo`/`--project` for same-project work and use `--parent-worktree active`
when requesting a child of the current workspace.

```text
# Child of the current worktree.
ORCA orchestration worker-start --task <task_id> --worktree new-child --agent codex --setup skip

# On a connected server, nested under your workspace; the Run stays on yours.
ORCA orchestration worker-start --task <task_id> --on <server> --worktree new-child --repo <exact_remote_repo_selector> --name <name> --agent codex --setup skip

# On a connected server, with no parent.
ORCA orchestration worker-start --task <task_id> --on <server> --worktree new-top-level --repo <exact_remote_repo_selector> --name <name> --agent codex --setup skip
```

With `--on`, both `new-child` and `new-top-level` need `--repo` naming a
project on that server. `new-child` nests the server's worktree under your
workspace on this machine. A server whose Orca is too old to nest across
machines still starts the worker, top-level, and the receipt's `warning` says
so; the worker is fine to use. `current` is not valid with `--on`.

`--name` is optional: without it Orca picks a name as it does for an unnamed
workspace, and the start output names the workspace it created.

After start, address a remote worker only by Dispatch ID, never by a terminal
handle.

Use setup only when required and authorized; long setup commands belong in the
background, never in extra terminal tabs. A separate worktree does not allow
two workers to own the same files at once. Keep the file split disjoint.
Pass Windows paths (`C:\...`) to Codex `-C`/`--add-dir` on Windows. Do not pass
WSL paths to Windows Codex. Browser checks stay with the coordinator because
Codex on this laptop cannot launch Playwright/Chromium.

Try `send` first to reuse a finished worker. A paired server may refuse
follow-ups to a settled worker; only then use `worker-start --on <server>`
within the cap. Record that exception and both Dispatch IDs.

## Agents on another server

To message an agent that already runs on a paired server, send with `--on`,
using the same server names as `worker-start --on`:

```bash
ORCA orchestration send --on <server> --to <term_…|orca_session_id:…> --subject "<text>" --body "<text>"
```

Your own Orca carries the mail and keeps the conversation. Replies come back to
your own `check`, and they wake you like local mail. The other agent answers
with a plain `reply --id <msg_id> --body <text>`; no flag is needed on either
side. Mail from another server names its sender as `<sender> on <server name>`.

`--environment <server>` runs one command on that server and delivers nothing back
to you, so an agent never mails with it. Your mailbox stays on your own Orca:
`check` takes no `--environment`. Read-only commands such as `inbox` or
`worker-list` with `--environment` show that server's records. A server whose Orca
is too old answers `server_mail_unsupported` and nothing is sent. Pair servers
with `orca pair` or in Settings.
