import type { CommandSpec } from './args'
import { findCommandSpec, isCommandGroup, matches, supportsBrowserPageFlag } from './args'
import { unknownCommandData } from './command-suggestion'
import { formatCommandScopedFlagHelp } from './command-scoped-flag-help'
import { FLAG_HELP_TEXT } from './flag-help-text'
import { ROOT_SHORT_HELP } from './root-short-help'

export function printHelp(specs: CommandSpec[], commandPath: string[] = [], all = false): void {
  // RA: root help is intentionally small; group and command help stay complete.
  if (commandPath.length === 0 && !all) {
    console.log(ROOT_SHORT_HELP)
    return
  }
  const exactSpec = findCommandSpec(specs, commandPath)
  if (exactSpec) {
    console.log(formatCommandHelp(exactSpec))
    return
  }

  if (isCommandGroup(specs, commandPath)) {
    console.log(formatGroupHelp(specs, commandPath))
    return
  }

  if (commandPath.length > 0) {
    const { nextSteps } = unknownCommandData(specs, commandPath)
    const recovery = nextSteps.map((step) => `Next step: ${step}`).join('\n')
    console.log(`Unknown command: ${commandPath.join(' ')}${recovery ? `\n${recovery}` : ''}\n`)
  }

  console.log(all ? formatGroupHelp(specs, []) : ROOT_SHORT_HELP)
}

export function formatCommandHelp(spec: CommandSpec): string {
  const lines = [`orca ${spec.path.join(' ')}`, '', `Usage: ${spec.usage}`, '', spec.summary]
  const displayedFlags =
    spec.argumentMode === 'passthrough'
      ? []
      : supportsBrowserPageFlag(spec)
        ? [...spec.allowedFlags, 'page']
        : spec.allowedFlags

  if (displayedFlags.length > 0) {
    lines.push('', 'Options:')
    for (const flag of displayedFlags) {
      lines.push(`  ${formatCommandFlagHelp(flag, spec.path)}`)
    }
  }

  if (spec.notes && spec.notes.length > 0) {
    lines.push('', 'Notes:')
    for (const note of spec.notes) {
      lines.push(`  ${note}`)
    }
  }

  if (spec.examples && spec.examples.length > 0) {
    lines.push('', 'Examples:')
    for (const example of spec.examples) {
      lines.push(`  $ ${example}`)
    }
  }

  return lines.join('\n')
}

export function formatGroupHelp(specs: CommandSpec[], groupPath: string[]): string {
  const group = groupPath.join(' ')
  // RA: --all reuses the catalogue without doubled spaces or the long root tutorial.
  const prefix = group ? `orca ${group}` : 'orca'
  const lines = [prefix, '', `Usage: ${prefix} <command> [options]`, '', 'Commands:']
  for (const spec of specs) {
    if (
      spec.hidden === true ||
      spec.path.length <= groupPath.length ||
      !matches(spec.path.slice(0, groupPath.length), groupPath)
    ) {
      continue
    }
    lines.push(
      `  ${spec.path
        .slice(groupPath.length)
        .join(' ')
        .padEnd(group ? 18 : 30)} ${spec.summary}`
    )
  }
  lines.push('', `Run \`${prefix} <command> --help\` for command-specific usage.`)
  return lines.join('\n')
}

function formatCommandFlagHelp(flag: string, commandPath: string[]): string {
  const command = commandPath.join(' ')
  const scopedHelp = formatCommandScopedFlagHelp(command, flag)
  if (scopedHelp) {
    return scopedHelp
  }
  if (command === 'terminal close' && flag === 'tab') {
    return '--tab                  Close the whole tab and wait for durable persistence'
  }
  if (command === 'terminal set-pane-title' && flag === 'title') {
    return '--title <text>         Custom title for one pane (pass "" to reset)'
  }
  if (command === 'orchestration worker-read' && flag === 'cursor') {
    return '--cursor <cursor>      Opaque cursor returned by a previous worker-read page'
  }
  if (command === 'orchestration worker-list' && flag === 'cursor') {
    return '--cursor <cursor>      Opaque page cursor copied from nextCursor'
  }
  if (command === 'orchestration worker-list' && flag === 'terminal-state') {
    return '--terminal-state <state> Terminal accounting filter: active, reclaimable, retained, release_pending, release_unknown, or released'
  }
  if (command.startsWith('orchestration ') && flag === 'full') {
    return '--full                 Print the full record Orca returned instead of the concise view'
  }
  if (command === 'skills get' && flag === 'full') {
    return '--full                 Print the full guide with bundled references'
  }
  if (command === 'orchestration worker-list' && flag === 'include-remote') {
    return '--include-remote      Include connected-server worker observations'
  }
  if (command === 'worktree create' && flag === 'parent-worktree') {
    return '--parent-worktree <selector> Parent selector such as identity:<identity>, active/current, id:<repo-id>::<path>, branch:<branch>, issue:<number>, path:<path>, folder:<id>, or worktree:<worktreeId>'
  }
  if (command === 'orchestration task-create' && flag === 'task-title') {
    return '--task-title <text>  Concise title for the orchestration task'
  }
  if (command === 'orchestration task-create' && flag === 'display-name') {
    return '--display-name <text> UI label shown for dispatched worker rows'
  }
  if (command === 'account add' && flag === 'agent') {
    return '--agent <id>           Account provider: claude or codex (default claude)'
  }
  if (command.startsWith('account ') && flag === 'agent') {
    return '--agent <id>           Account provider: claude or codex'
  }
  return formatFlagHelp(flag)
}

export function formatFlagHelp(flag: string): string {
  return FLAG_HELP_TEXT[flag] ?? `--${flag}`
}
