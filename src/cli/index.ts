#!/usr/bin/env node
import { ROOT_SHORT_HELP } from './root-short-help'
import type { RuntimeClient } from './runtime-client'

// Defer the runtime graph until after help and validation; await it to keep ctx.client synchronous.
async function loadRuntimeClientClass(): Promise<typeof RuntimeClient> {
  return (await import('./runtime-client.js')).RuntimeClient
}

// The SSH bridge runs here, but ORCA_CLI_CWD carries the remote caller's directory.
function resolveInvocationCwd(): string {
  const override = process.env.ORCA_CLI_CWD
  return typeof override === 'string' && override.length > 0 ? override : process.cwd()
}

export async function main(
  argv = process.argv.slice(2),
  cwd = resolveInvocationCwd()
): Promise<void> {
  // RA: root help loads no catalogue, dispatch, discovery or runtime graph.
  if (argv.length === 0 || (argv.length === 1 && ['--help', '-h', 'help'].includes(argv[0]))) {
    console.log(ROOT_SHORT_HELP)
    return
  }
  // Why: version audits use the bundled launcher; Electron intercepts direct binary version flags.
  if (argv.length === 1 && (argv[0] === '--version' || argv[0] === '-v')) {
    const { readOrcaCliVersion } = await import('./cli-version.js')
    const version = readOrcaCliVersion()
    if (!version) {
      process.stderr.write('Could not determine the Orca version for this build.\n')
      process.exitCode = 1
      return
    }
    process.stdout.write(`${version}\n`)
    return
  }
  if (argv[0] === 'agent-teams-tmux') {
    await runAgentTeamsTmuxShim(argv.slice(1))
    return
  }
  if (argv[0] === 'claude-teams') {
    await runClaudeTeams(argv.slice(1), cwd)
    return
  }
  const {
    findCommandSpec,
    isCommandGroup,
    normalizeCommandPositionals,
    parseArgs,
    resolveHelpPath,
    specPaths,
    validateCommandAndFlags
  } = await import('./args.js')
  const { COMMAND_SPECS } = await import('./specs/index.js')
  const { printHelp } = await import('./help.js')
  const COMMAND_PATHS = COMMAND_SPECS.flatMap((spec) => specPaths(spec))
  // RA: the full integration catalogue remains available without runtime discovery.
  if (argv.length === 2 && argv[0] === 'help' && argv[1] === '--all') {
    printHelp(COMMAND_SPECS, [], true)
    return
  }
  const parsed = normalizeCommandPositionals(
    COMMAND_SPECS,
    parseArgs(argv, COMMAND_PATHS, COMMAND_SPECS)
  )
  const helpPath = resolveHelpPath(parsed)
  if (helpPath !== null) {
    printHelp(COMMAND_SPECS, helpPath)
    if (
      helpPath.length > 0 &&
      !findCommandSpec(COMMAND_SPECS, helpPath) &&
      !isCommandGroup(COMMAND_SPECS, helpPath)
    ) {
      process.exitCode = 1
    }
    return
  }
  if (parsed.commandPath.length === 0) {
    printHelp(COMMAND_SPECS, [])
    return
  }
  if (
    parsed.flags.size === 0 &&
    !findCommandSpec(COMMAND_SPECS, parsed.commandPath) &&
    isCommandGroup(COMMAND_SPECS, parsed.commandPath)
  ) {
    printHelp(COMMAND_SPECS, parsed.commandPath)
    return
  }
  const { dispatch } = await import('./dispatch.js')
  const { resolveEnvironmentSelectorForStore, resolveHostFlagEnvironmentId } =
    await import('./execution-host-flag.js')
  const { fetchSshTargetSummaries, listSshTargets } =
    await import('./host-selector-alternatives.js')
  const { reportCliError } = await import('./cli-error.js')
  const { RuntimeClientError } = await import('./runtime/types.js')
  const { cliErrorExitCode } = await import('./cli-exit-code.js')
  const { resolveOrchestrationCliExecutable } =
    await import('./runtime/orchestration-recovery-command.js')
  const { refuseConflictingSessionCallerFlags } = await import('./session-caller-flags.js')
  const { ignoresRemoteSelection } = await import('./remote-selection-scope.js')
  const { isLocalEnvironmentSelector, refuseLocalManagementSelector } =
    await import('./local-environment-selector.js')
  const json = parsed.flags.has('json')

  try {
    // Report invalid commands before runtime lookup can mask them with connection errors.
    validateCommandAndFlags(COMMAND_SPECS, parsed)
    const commandSpec = findCommandSpec(COMMAND_SPECS, parsed.commandPath)
    refuseConflictingSessionCallerFlags(commandSpec, parsed.flags)
    await refuseLocalManagementSelector(parsed.commandPath, parsed.flags)
    const RuntimeClientClass = await loadRuntimeClientClass()
    // `--on` runs on the caller's own Orca, which reaches that server; an inherited selection never reroutes it.
    const onCallersOrca = runsOnCallersOrca(parsed.commandPath, parsed.flags)
    if (
      onCallersOrca &&
      (parsed.flags.has('pairing-code') ||
        (parsed.flags.has('environment') &&
          !isLocalEnvironmentSelector(parsed.flags.get('environment'))))
    ) {
      throw new RuntimeClientError(
        'invalid_argument',
        '--on already names the server; drop --environment. Your own Orca reaches it.'
      )
    }
    const ignoreRemoteSelection = onCallersOrca || ignoresRemoteSelection(parsed.commandPath)
    const pairingCode = ignoreRemoteSelection ? null : parsed.flags.get('pairing-code')
    const environmentSelector = ignoreRemoteSelection ? null : parsed.flags.get('environment')
    // An explicit local route suppresses ambient ORCA_ENVIRONMENT and pairing codes.
    const explicitLocal = isLocalEnvironmentSelector(environmentSelector)
    if (explicitLocal && typeof pairingCode === 'string') {
      throw new RuntimeClientError(
        'invalid_argument',
        'Use either --pairing-code or --environment, not both.'
      )
    }
    // Eagerly resolve explicit --environment; stale ambient config must not break local-only commands.
    const listSshTargetsForSuggestion = async (): Promise<{ id: string; label: string }[]> =>
      listSshTargets(new RuntimeClientClass(undefined, undefined, null, null))
    const storeEnvironmentSelector =
      typeof environmentSelector === 'string' && !explicitLocal
        ? await resolveEnvironmentSelectorForStore(environmentSelector, listSshTargetsForSuggestion)
        : null
    // Select the paired connection before constructing the client; reject conflicting environments.
    const hostEnvironmentId = ignoreRemoteSelection
      ? null
      : await resolveHostFlagEnvironmentId(parsed.flags, {
          // SSH targets belong to this machine, even when the missing name was a paired server.
          listSshTargets: listSshTargetsForSuggestion,
          verifySshTargets: async () =>
            (
              await fetchSshTargetSummaries<{ id: string; label: string }>(
                new RuntimeClientClass(undefined, undefined, null, null)
              )
            ).targets,
          pairingCode: typeof pairingCode === 'string' ? pairingCode : null,
          environmentSelector:
            typeof environmentSelector === 'string'
              ? { value: environmentSelector, label: '--environment' }
              : process.env.ORCA_ENVIRONMENT
                ? { value: process.env.ORCA_ENVIRONMENT, label: 'ORCA_ENVIRONMENT' }
                : null
        })
    // Stored host identities use ids, so canonicalize names before any downstream comparison.
    if (hostEnvironmentId !== null) {
      parsed.flags.set('host', `runtime:${hostEnvironmentId}`)
    }
    // null suppresses RuntimeClient's ORCA_PAIRING_CODE / ORCA_ENVIRONMENT default parameters.
    const suppressed = ignoreRemoteSelection || explicitLocal ? null : undefined
    // An explicit runtime host overrides an ambient pairing code.
    const remotePairingCode =
      hostEnvironmentId !== null ? null : typeof pairingCode === 'string' ? pairingCode : suppressed
    const remoteEnvironment = hostEnvironmentId ?? storeEnvironmentSelector ?? suppressed
    let client: RuntimeClient | undefined
    await dispatch(parsed.commandPath, {
      flags: parsed.flags,
      // Why: local-only handlers must not resolve runtime metadata just to dispatch.
      get client() {
        client ??= new RuntimeClientClass(
          undefined,
          undefined,
          remotePairingCode,
          remoteEnvironment,
          resolveOrchestrationCliExecutable(),
          argv
        )
        return client
      },
      cwd,
      json,
      rawArgs: argv
    })
  } catch (error) {
    const worktreeSelector = parsed.flags.get('worktree')
    const repoSelector = parsed.flags.get('repo')
    const hostFlag = parsed.flags.get('host')
    reportCliError(error, json, {
      commandPath: parsed.commandPath,
      ...(typeof worktreeSelector === 'string' ? { worktreeSelector } : {}),
      ...(typeof repoSelector === 'string' ? { repoSelector } : {}),
      remoteServerSelected:
        !isLocalEnvironmentSelector(parsed.flags.get('environment')) &&
        (parsed.flags.has('environment') ||
          parsed.flags.has('pairing-code') ||
          (typeof hostFlag === 'string' && hostFlag.startsWith('runtime:')) ||
          Boolean(process.env.ORCA_ENVIRONMENT?.trim() || process.env.ORCA_PAIRING_CODE?.trim())),
      conciseOrchestration: parsed.commandPath[0] === 'orchestration' && !parsed.flags.has('full')
    })
    process.exitCode = cliErrorExitCode(error, parsed.commandPath)
  }
}

const ON_CALLERS_ORCA_COMMANDS: ReadonlySet<string> = new Set(['send', 'reply', 'worker-start'])

function runsOnCallersOrca(
  commandPath: readonly string[],
  flags: ReadonlyMap<string, string | boolean>
): boolean {
  return (
    commandPath[0] === 'orchestration' &&
    ON_CALLERS_ORCA_COMMANDS.has(commandPath[1] ?? '') &&
    flags.has('on')
  )
}

async function runClaudeTeams(argv: string[], cwd: string): Promise<void> {
  const { dispatch } = await import('./dispatch.js')
  const { reportCliError } = await import('./cli-error.js')

  try {
    // Forward Claude Code arguments verbatim so new flags work without Orca changes.
    const client = new (await loadRuntimeClientClass())(undefined, undefined, null, null)
    await dispatch(['claude-teams'], {
      flags: new Map(),
      client,
      cwd,
      json: false,
      rawArgs: argv
    })
  } catch (error) {
    reportCliError(error, false, { commandPath: ['claude-teams'] })
    process.exitCode = 1
  }
}

async function runAgentTeamsTmuxShim(argv: string[]): Promise<void> {
  const { reportCliError } = await import('./cli-error.js')

  try {
    const client = new (await loadRuntimeClientClass())(undefined, 10_000)
    const response = await client.call<{
      tmux: { stdout: string; stderr: string; exitCode: number }
    }>(
      'agentTeams.tmuxCompat',
      {
        teamId: process.env.ORCA_AGENT_TEAMS_TEAM_ID,
        token: process.env.ORCA_AGENT_TEAMS_TOKEN,
        envPane: process.env.TMUX_PANE,
        cwd: process.cwd(),
        argv
      },
      { timeoutMs: 10_000 }
    )
    process.stdout.write(response.result.tmux.stdout)
    process.stderr.write(response.result.tmux.stderr)
    process.exitCode = response.result.tmux.exitCode
  } catch (error) {
    reportCliError(error, false, { commandPath: ['agent-teams-tmux'] })
    process.exitCode = 1
  }
}

if (require.main === module) {
  void main()
}
