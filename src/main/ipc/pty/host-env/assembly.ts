import { applyClaudeAgentViewEnv } from './claude-agent-view'
import { resolveTerminalInlineImagesEnabled } from '../../../../shared/terminal/images/terminal-inline-images-settings'
import { resolveSetupAgentSequenceLaunchCommand } from '../../../../shared/agent-launch/startup/setup-agent-sequencing'

import { applyTerminalGitCredentialPromptGuard } from '../../../../shared/shell/launch/terminal-git-credential-guard'

import { agentHookServer } from '../../../agent-hooks/server/agent-hook-server'
import { wslHookRelayManager } from '../../../agent-hooks/wsl-relay/wsl-hook-relay-manager'
import { wslInteropHealthMonitor } from '../../../wsl/execution/wsl-interop-health'

import { prependOrcaCliDirToChildPath } from '../../../cli/launchers/orca-cli-child-path'
import { getManagedWslCliDir, getWslCliCommandName } from '../../../cli/wsl/wsl-managed-cli'
import { stripLegacyTerminalShimEnv } from '../../../pty/shell-startup/legacy-terminal-shim-dir'
import { mergePersistedWindowsPath } from '../../../pty/environment/windows-environment-path'
import { resolveCodexShellLaunchPreflightCommand } from '../../../pty/shell-startup/codex-shell-launch-preflight'
import { scheduleCodexHookReconcile } from '../../../codex/hooks/reconciliation/codex-hook-reconcile'
import { buildConfiguredProxyEnv } from '../../../../shared/network-proxy'
import { isTuiAgentEnabled } from '../../../../shared/agent-launch/catalog/tui-agent-selection'
import type { BuildPtyHostEnvOptions } from './types'
import { stripInheritedOrcaCodexHomeOverride } from './codex-home'

import { AGENT_HOOK_RUNTIME_ENV_KEYS } from './spawn-env-keys'

import { applyRemoteViewerClipboardEnv } from './remote-viewer-clipboard-env'

/** Mutate host-local PTY environment only for local execution; SSH cannot use these loopback endpoints or filesystem paths. */
export function buildPtyHostEnv(
  _id: string,
  baseEnv: Record<string, string>,
  opts: BuildPtyHostEnvOptions
): Record<string, string> {
  mergePersistedWindowsPath(baseEnv)
  Object.assign(baseEnv, buildConfiguredProxyEnv(opts.networkProxySettings))

  // Claude currently recognizes image support only in a short terminal allowlist.
  if (
    opts.launchAgent === 'claude' &&
    resolveTerminalInlineImagesEnabled(opts.terminalInlineImages) &&
    baseEnv.CLAUDE_CODE_FORCE_TERMINAL_IMAGES === undefined &&
    process.env.CLAUDE_CODE_FORCE_TERMINAL_IMAGES === undefined
  ) {
    baseEnv.CLAUDE_CODE_FORCE_TERMINAL_IMAGES = '1'
  }

  // RA: terminal launch prepares only Claude/Codex hooks and the Orca CLI.
  const launchCommandHint = resolveSetupAgentSequenceLaunchCommand(baseEnv, opts.launchCommand)
  applyClaudeAgentViewEnv(baseEnv, opts)
  applyTerminalGitCredentialPromptGuard(baseEnv, {
    launchCommand: launchCommandHint,
    isUnattended: opts.launchAgent !== undefined,
    deferGitConfigGuardToHost: opts.deferGitConfigGuardToDaemon
  })
  for (const key of AGENT_HOOK_RUNTIME_ENV_KEYS) {
    delete baseEnv[key]
  }
  if (opts.agentStatusHooksEnabled) {
    Object.assign(baseEnv, agentHookServer.buildPtyEnv())
    if (opts.isWsl === true) {
      const distro = opts.wslDistro ?? null
      wslHookRelayManager.ensureForDistro(distro, opts.selectedCodexHomePath)
      const guestEndpoint = wslHookRelayManager.getGuestEndpointFilePath(distro)
      if (guestEndpoint) {
        baseEnv.ORCA_AGENT_HOOK_ENDPOINT = guestEndpoint
      }
      const claude =
        opts.claudeSubagentNavigationEnabled !== false &&
        isTuiAgentEnabled('claude', opts.disabledTuiAgents)
          ? wslHookRelayManager.getClaudeAgentView(distro)
          : null
      if (claude) {
        baseEnv.ORCA_CLAUDE_AGENT_VIEW_PLUGIN_DIR = claude.pluginDir
        baseEnv.ORCA_CLAUDE_CONFIG_DIR = claude.configDir
      }
    }
  }

  // Keep managed Codex home selection PTY-scoped across dev/prod instances.
  if (opts.skipCodexHomeEnv) {
    delete baseEnv.CODEX_HOME
    delete baseEnv.ORCA_CODEX_HOME
    delete baseEnv.ORCA_CODEX_LAUNCH_PREFLIGHT
  } else if (opts.selectedCodexHomePath) {
    baseEnv.CODEX_HOME = opts.selectedCodexHomePath
    // Startup files may re-export CODEX_HOME; wrappers restore this pane's selected runtime home.
    baseEnv.ORCA_CODEX_HOME = opts.selectedCodexHomePath
    const preflightCommand = resolveCodexShellLaunchPreflightCommand({
      hooksEnabled:
        opts.agentStatusHooksEnabled && isTuiAgentEnabled('codex', opts.disabledTuiAgents),
      isPackaged: opts.isPackaged,
      isWsl: opts.isWsl,
      managedHomePath: opts.selectedCodexHomePath,
      resourcesPath: opts.resourcesPath
    })
    if (preflightCommand) {
      baseEnv.ORCA_CODEX_LAUNCH_PREFLIGHT = preflightCommand
    } else {
      delete baseEnv.ORCA_CODEX_LAUNCH_PREFLIGHT
    }
  } else if (opts.stripInheritedOrcaCodexHome) {
    stripInheritedOrcaCodexHomeOverride(baseEnv)
    delete baseEnv.ORCA_CODEX_LAUNCH_PREFLIGHT
  } else {
    delete baseEnv.ORCA_CODEX_LAUNCH_PREFLIGHT
  }

  if (!opts.isWsl) {
    // Native panes may run Codex later by typing it; recheck hooks against any updated Codex install.
    scheduleCodexHookReconcile()
  }

  // An inherited WSL CLI path belongs to another launch.
  delete baseEnv.ORCA_WSL_CLI_DIR
  // WSL wrapper state and development CLI routing require the owning instance's userData root.
  if (opts.isWsl) {
    wslInteropHealthMonitor.noteActivity(opts.wslDistro ?? null)
    baseEnv.ORCA_USER_DATA_PATH = opts.userDataPath
    // Advertise the managed WSL CLI name for agent guidance.
    baseEnv.ORCA_CLI_COMMAND = getWslCliCommandName(opts.isPackaged)
    const managedCliDir = getManagedWslCliDir(opts)
    if (managedCliDir) {
      baseEnv.ORCA_WSL_CLI_DIR = managedCliDir
    }
  } else {
    if (!opts.isPackaged) {
      baseEnv.ORCA_USER_DATA_PATH ??= opts.userDataPath
    }
    delete baseEnv.ORCA_CLI_COMMAND
  }
  prependOrcaCliDirToChildPath(baseEnv, {
    isPackaged: opts.isPackaged,
    userDataPath: opts.userDataPath,
    resourcesPath: opts.resourcesPath
  })

  if (
    opts.routeBrowserOpensToClient === true &&
    baseEnv.BROWSER === undefined &&
    process.env.BROWSER === undefined
  ) {
    const cliCommand = opts.isWsl ? getWslCliCommandName(opts.isPackaged) : 'orca'
    baseEnv.BROWSER = `${cliCommand} open-url --url %s`
  }
  // Browser-relayed and SSH-managed headless hosts both have viewers on another machine.
  applyRemoteViewerClipboardEnv(baseEnv, {
    launchAgent: opts.launchAgent,
    viewerIsRemote: opts.routeBrowserOpensToClient === true
  })

  // Scrub after prepends: sparse daemon env may make them reread unsanitized ambient PATH.
  stripLegacyTerminalShimEnv(baseEnv, process.platform)

  return baseEnv
}
