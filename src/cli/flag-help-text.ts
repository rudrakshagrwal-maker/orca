export const FLAG_HELP_TEXT: Record<string, string> = {
  parent: '--parent <handle>      Parent agent terminal handle', // RA: explicit attachment.
  'external-worktree-visibility':
    '--external-worktree-visibility show|hide|inherit  Override or inherit non-Orca worktree visibility',
  agent: '--agent <id>          Launch claude or codex in the first terminal',
  'agent-wait': "--agent-wait           Add each agent row's terminal wait verdict to JSON output",
  'base-branch': '--base-branch <ref>    Base branch/ref to create the worktree from',
  command: '--command <text>       Command to run in the terminal on startup',
  comment: '--comment <text>       Comment stored in Orca metadata',
  cursor: '--cursor <n>           Line cursor from a previous read (returns only new output)',
  action: '--action <name>       Secondary accessibility action name',
  activate: '--activate             Reveal the new worktree in the Orca app',
  direction:
    '--direction <dir>      Direction: up|down|left|right for scroll, horizontal|vertical for split',
  'display-name': '--display-name <name>  Override the Orca display name',
  environment:
    "--environment <selector> Run against a saved paired Orca server (id or name), or `local` for this machine's own Orca over ORCA_ENVIRONMENT/ORCA_PAIRING_CODE; terminal handles belong to the server that issued them",
  'pairing-code':
    '--pairing-code <code>  Run against a remote Orca server using an orca://pair?... code',
  title: '--title <text>         Custom title for the terminal tab (omit to reset)',
  enter: '--enter                Append Enter after sending text',
  'wait-submit':
    '--wait-submit <seconds> Wait up to this long to see the prompt start a turn; never resends',
  'retry-request':
    '--retry-request <id>  Reissue an earlier request by its ID; replays its result instead of repeating it',
  force:
    '--force                Force worktree removal when supported; does not force branch deletion',
  focus: '--focus                Reveal the created terminal session in Orca',
  for: '--for exit|tui-idle    Wait condition to satisfy',
  help: '--help                 Show this help message',
  'include-visual-layouts': '--include-visual-layouts Include tab and pane topology in JSON output',
  interrupt: '--interrupt            Send as an interrupt-style input when supported',
  'keep-open': '--keep-open            Keep the worker open after it finishes',
  'spec-file': '--spec-file <path|->  Read the spec from a file or stdin',
  id: '--id <id>             Identifier for a target item or permission',
  json: '--json                 Emit machine-readable JSON',
  key: '--key <key>            Key argument for this command',
  limit: '--limit <n>            Maximum number of rows to return',
  local: '--local                Target the current project instead of the global install',
  skill: '--skill <name>         Bundled skill to act on; repeat for several',
  mode: '--mode <mode>          Mode such as edit, diff, or both',
  model: '--model <id>          Provider model id for a new agent launch',
  effort: '--effort <level>      Reasoning effort for the selected model',
  name: '--name <name>          Name for the new worktree',
  'no-parent': '--no-parent            Force no parent lineage for unrelated work',
  'parent-worktree':
    '--parent-worktree <selector> Parent worktree selector such as identity:<identity>, id:<repo-id>::<path>, folder:<id>, name:<displayName>, branch:<branch>, issue:<number>, path:<path>, or active/current',
  'parent-environment':
    "--parent-environment <environment> Environment holding --parent-worktree: local, or a saved environment id or name (default: the worktree's own)",
  path: '--path <path>          Path argument for the command',
  prompt: '--prompt <text>        Prompt text for agent-backed commands',
  query: '--query <text>        Search text for matching refs',
  ref: '--ref <ref>            Base ref to persist for the repo',
  repo: '--repo <selector>      Repo selector such as id:<id>, name:<name>, or path:<path>',
  setup: '--setup run|skip|inherit Setup policy for repo-defined setup hooks',
  surface: '--surface terminal Start the agent CLI in a terminal',
  shell: '--shell <shell>        Windows shell the terminal itself runs as',
  terminal: '--terminal <handle>  Full handle, unique UUID prefix, or unique tab-title substring', // RA: short selectors.
  layout: '--layout               Show the terminal layout tree', // RA: opt-in text detail.
  preview: '--preview              Show terminal output previews', // RA: opt-in text detail.
  text: '--text <text>          Text payload to send or type',
  'task-id': '--task-id <id>        Task id to include in orchestration payload JSON',
  'task-title': '--task-title <text>    Concise title for an orchestration task',
  'dispatch-id': '--dispatch-id <id>    Dispatch id to include in orchestration payload JSON',
  'files-modified': '--files-modified <csv> Comma-separated files for orchestration payload JSON',
  'report-path': '--report-path <path>  Report path to include in orchestration payload JSON',
  phase: '--phase <text>        Worker phase to include in orchestration payload JSON',
  'timeout-ms': '--timeout-ms <ms>     Maximum wait time before timing out',
  worktree:
    '--worktree <selector>  Worktree selector such as identity:<identity>, id:<repo-id>::<path>, folder:<id> (where the command takes folder workspaces), name:<displayName>, branch:<branch>, issue:<number>, path:<path>, or active/current',
  'workspace-status':
    '--workspace-status <id> Board status id (defaults: todo, in-progress, in-review, completed)',
  staged: '--staged               Open staged source-control changes',
  depth: '--depth <n>            Maximum snapshot tree depth',
  full: '--full                 Return the complete output for this command',
  element: '--element <ref>        Element ref from snapshot (e.g. e3)',
  url: '--url <url>            URL to navigate to',
  value: '--value <text>         Value to fill or select',
  input: '--input <text>         Text to type at current focus',
  expression: '--expression <js>     JavaScript expression to evaluate',
  amount: '--amount <pixels>      Scroll distance in pixels',
  index: '--index <n>            Tab index to switch to',
  page: '--page <id>            Stable browser page id from `orca tab list --json`',
  'expect-url':
    '--expect-url <url>     Fail before acting unless the page is at this exact absolute URL',
  profile: '--profile <id>        Browser profile id',
  'show-profile': '--show-profile        Include tab profile in text output',
  format: '--format <png|jpeg>    Screenshot image format'
}
