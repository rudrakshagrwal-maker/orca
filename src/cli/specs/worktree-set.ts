import type { CommandSpec } from '../args'
import { GLOBAL_FLAGS } from '../args'

export const WORKTREE_SET_COMMAND_SPEC: CommandSpec = {
  path: ['worktree', 'set'],
  summary: 'Update Orca metadata for a worktree',
  usage:
    'orca worktree set --worktree <selector> [--display-name <name>] [--comment <text>] [--workspace-status <id>] [--unread|--read] [--parent-worktree <selector> [--parent-environment <environment>]|--no-parent] [--json]',
  allowedFlags: [
    ...GLOBAL_FLAGS,
    'worktree',
    'display-name',
    'comment',
    'workspace-status',
    'unread',
    'read',
    'parent-worktree',
    'parent-environment',
    'no-parent'
  ],
  notes: [
    'Workspace status ids match the board columns (defaults: todo, in-progress, in-review, completed); custom statuses use their configured id.',
    'Pass --comment "" (or --comment=) to clear the comment.',
    "--parent-worktree is looked up in the worktree's own environment; add --parent-environment <local|environment-id> for a parent in another environment. No other environment is searched.",
    'On a folder workspace (folder:<id>, or a path:/name: selector that matches one), only --display-name, --comment, --workspace-status and --unread/--read apply. Parent flags are refused.'
  ],
  examples: [
    'orca worktree set --worktree active --comment "" --json',
    'orca worktree set --worktree active --workspace-status in-review --unread --json'
  ]
}
