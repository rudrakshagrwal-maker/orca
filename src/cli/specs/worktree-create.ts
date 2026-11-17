import type { CommandSpec } from '../args'
import { GLOBAL_FLAGS } from '../args'

export const WORKTREE_CREATE_COMMAND_SPEC: CommandSpec = {
  path: ['worktree', 'create'],
  summary: 'Create a new Orca-managed worktree',
  usage:
    'orca worktree create --name <name> [--repo <selector>|--project <id-or-name> [--host <host>]|--project-host-setup <id>] [--agent <id>] [--prompt <text>] [--model <id>] [--effort <level>] [--surface terminal] [--setup run|skip|inherit] [--base-branch <ref>] [--branch <name>] [--comment <text>] [--parent-worktree <selector> [--parent-environment <environment>]] [--no-parent] [--run-hooks] [--activate] [--retry-launch <operationId>] [--json]',
  allowedFlags: [
    ...GLOBAL_FLAGS,
    'repo',
    'project',
    'host',
    'project-host-setup',
    'name',
    'agent',
    'prompt',
    'model',
    'effort',
    'surface',
    'retry-launch',
    'base-branch',
    'branch',
    'comment',
    'setup',
    'parent-worktree',
    'parent-environment',
    'no-parent',
    'run-hooks',
    'activate'
  ],
  notes: [
    'This creates a new checkout. For a fresh agent in an existing worktree, use `orca agent launch` instead.',
    'By default, Orca records the new worktree as a child of the caller context when it can infer one from the Orca terminal or current directory.',
    'If --repo is omitted, Orca infers the repo from the current Orca-managed worktree.',
    'Use --project to create on a ready project host setup without spelling the backing repo id. --project takes the project id or the display name from `orca project list`.',
    '--host is only needed when the project is set up on more than one host; with a single setup Orca uses it. When it is ambiguous the error names every host the project is set up on.',
    '--host takes local, ssh:<target-id>, runtime:<environment-id>, or the bare host name `orca host list` prints for any of them.',
    'For related work, use the inferred parent or pass --parent-worktree active, folder:<id>, or worktree:<worktreeId> to make the relationship explicit. Worktree ids are the full <repo-id>::<path> values returned by `orca worktree list --json`.',
    "--parent-worktree is looked up in the new worktree's environment. For a parent in another environment, add --parent-environment with local or a saved environment id or name, such as a row's address.environment from `orca worktree ps --json`. No other environment is searched.",
    'Use --no-parent when the new worktree should be independent of the current context.',
    'Pass --branch to name the Git branch without the configured prefix (a taken name gets a numeric suffix); --base-branch selects the starting ref instead.',
    '--no-parent only affects Orca lineage; omit --base-branch to use the repo default base, or pass the default base ref explicitly for independent top-level work.',
    'By default this creates the worktree and its first terminal without switching the active Orca view.',
    'Pass --agent claude or --agent codex to start an agent with the worktree; --prompt sends initial work to it. --model and --effort select its model and reasoning effort.',
    'After a lost agent launch reply, re-issue the same command from the same directory on the same host with --retry-launch <operationId> from the error. Never retry as a fresh launch; older hosts require inspecting the workspace first.',
    'With --agent --json, result.launch says what started: launch.outcome.kind (structured chat or terminal), launch.outcome.handle, and launch.receipt.detail for why. An Orca host older than this returns the terminal agent handle in result.agentTerminalHandle instead.',
    'Repo-defined setup hooks follow the repository setup policy; pass --setup run to force them.',
    'Pass --activate when the CLI caller intentionally wants to reveal the new worktree in the app.',
    'Passing --run-hooks is kept as a legacy alias for --setup run and reveals the worktree.'
  ],
  examples: [
    'orca worktree create --name agent-task --agent codex --prompt "hi" --json',
    'orca worktree create --name design --no-parent --agent codex --model gpt-6-astra --effort high --prompt "Write the design doc" --json',
    'orca worktree create --repo id:<repoId> --name related-task --json',
    'orca worktree create --project github:stablyai/orca --host runtime:03ef704c-b180-4b10-998d-e28fbd5de9a3 --name benchmark --json',
    'orca worktree create --repo id:<repoId> --name agent-task --agent codex --prompt "hi" --json',
    'orca worktree create --repo id:<repoId> --name folder-child --parent-worktree folder:<folderId> --json',
    'orca worktree create --repo id:<repoId> --name related-task --parent-worktree active --json',
    'orca worktree create --environment <environment-id> --repo id:<repoId> --name child --parent-environment local --parent-worktree folder:<folderId> --json',
    'orca worktree create --repo id:<repoId> --name independent-task --no-parent --json'
  ]
}
