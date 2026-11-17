import type { AgentSessionRecord } from '../../../../shared/agent-session/lifecycle/agent-session-record'
import { requireLegacyAgentSessionAccountHome } from '../../../../shared/agent-session/lifecycle/agent-session-account-home'
import { resolveTuiAgentLaunchEnv } from '../../../../shared/agent-launch/choices/tui-agent-launch-defaults'
import { overlayEnvironmentVariables } from '../../../../shared/environment-overlay'
import { getClaudeProfileRouter } from '../../../claude-accounts/claude-profile-installed-router'
import {
  claudeConfigDirEnvPatch,
  withoutInheritedClaudeConfigDir
} from '../../../claude/claude-config-dir-pin'
import { resolveClaudeStructuredLaunchHome } from '../../../claude/structured/launch/claude-structured-launch-home'
import type { CommitMessageGenerationTarget } from '../../../text-generation/source-control-text-generation-types'

/** Default naming follows the native account binding; explicit recipes retain CLI routing. */
export async function chatNamingAgentTarget(
  record: AgentSessionRecord,
  cwd: string,
  resolveEnvironment: (agent: string) => Promise<Record<string, string>>,
  settings: Parameters<typeof resolveTuiAgentLaunchEnv>[1]
): Promise<CommitMessageGenerationTarget> {
  let env = await resolveEnvironment(record.provider)
  // RA: naming never resolves a removed provider.
  const home = requireLegacyAgentSessionAccountHome(record.accountHome)
  if (record.provider === 'claude') {
    env = overlayEnvironmentVariables(
      withoutInheritedClaudeConfigDir(env),
      resolveTuiAgentLaunchEnv('claude', settings),
      process.platform
    )
    const path = await resolveClaudeStructuredLaunchHome(getClaudeProfileRouter(), env, home.path)
    const patch = claudeConfigDirEnvPatch(path, { env })
    return { kind: 'local', cwd, env: { CLAUDE_CONFIG_DIR: undefined, ...env, ...patch } }
  }
  return { kind: 'local', cwd, env: { ...env, [home.variable]: home.path } }
}
