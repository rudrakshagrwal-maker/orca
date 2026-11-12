import { describe, expect, it } from 'vitest'
import {
  buildClaudeResumeLaunchCommand,
  withClaudeLaunchSessionId
} from './agent-launch/startup/agent-resume-launch-command'
import {
  tokenizeStartupCommand,
  type AgentStartupShell
} from './agent-launch/startup/tui-agent-startup-shell'
const SHELLS: { platform: NodeJS.Platform; shell: AgentStartupShell }[] = [
  { platform: 'linux', shell: 'posix' },
  { platform: 'darwin', shell: 'posix' },
  { platform: 'win32', shell: 'powershell' },
  { platform: 'win32', shell: 'cmd' }
]

// RA: Orca names each fresh Claude launch's session so restore resumes that exact session.
describe('withClaudeLaunchSessionId', () => {
  const NAMED = '0b6f2f4e-8c1d-4c55-9f5e-2f1a7c3d9e10'

  it.each(SHELLS)('names a plain launch ($shell)', ({ shell }) => {
    const tokens = tokenizeStartupCommand(
      withClaudeLaunchSessionId('claude', NAMED, shell) ?? '',
      shell
    )
    expect(tokens.ok && tokens.tokens).toEqual(['claude', '--session-id', NAMED])
  })

  it.each(SHELLS)('keeps user args and names the launch ($shell)', ({ shell }) => {
    const command = withClaudeLaunchSessionId('claude --dangerously-skip-permissions', NAMED, shell)
    const tokens = tokenizeStartupCommand(command ?? '', shell)
    expect(tokens.ok && tokens.tokens).toEqual([
      'claude',
      '--dangerously-skip-permissions',
      '--session-id',
      NAMED
    ])
  })

  it.each(SHELLS)('leaves a launch that already picks a session alone ($shell)', ({ shell }) => {
    expect(withClaudeLaunchSessionId('claude --resume abc', NAMED, shell)).toBeNull()
    expect(withClaudeLaunchSessionId('claude --continue', NAMED, shell)).toBeNull()
    expect(withClaudeLaunchSessionId('claude --session-id abc', NAMED, shell)).toBeNull()
  })

  it('leaves commands without claude in command position alone', () => {
    expect(withClaudeLaunchSessionId('codex', NAMED, 'posix')).toBeNull()
    expect(withClaudeLaunchSessionId("sh -c 'claude'", NAMED, 'posix')).toBeNull()
  })

  it.each(SHELLS)(
    'restore drops the launch name so --resume stands alone ($shell)',
    ({ shell }) => {
      const named = withClaudeLaunchSessionId('claude', NAMED, shell) ?? ''
      const restored = buildClaudeResumeLaunchCommand(named, ['--resume', NAMED], shell)
      const tokens = tokenizeStartupCommand(restored, shell)
      expect(tokens.ok && tokens.tokens).toEqual(['claude', '--resume', NAMED])
    }
  )
})
