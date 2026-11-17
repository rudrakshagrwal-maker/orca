import { describe, expect, it } from 'vitest'
import { buildAgentStartupPlan } from './tui-agent-startup'
import { tokenizeStartupCommand } from './tui-agent-startup-shell'

describe('native OpenCode startup submission intent', () => {


  it.each(['posix', 'powershell', 'cmd'] as const)(
    'keeps run and its flags before a positional message in %s',
    (shell) => {
      for (const agent of ['opencode', 'opencode2'] as const) {
        const prompt = '--literal task with unicode é'
        const plan = buildAgentStartupPlan({
          agent,
          prompt,
          cmdOverrides: { [agent]: 'opencode --log-level debug run --standalone' },
          platform: shell === 'posix' ? 'linux' : 'win32',
          shell,
          agentEnv: { CUSTOM_CONFIG: 'kept' }
        })
        expect(plan).not.toBeNull()
        const parsed = tokenizeStartupCommand(plan?.launchCommand ?? '', shell)
        expect(parsed.ok).toBe(true)
        if (!parsed.ok) {
          throw new Error(parsed.error)
        }
        expect(parsed.tokens).toEqual([
          'opencode',
          '--log-level',
          'debug',
          'run',
          '--standalone',
          '--',
          prompt
        ])
        expect(plan?.env).toEqual({ CUSTOM_CONFIG: 'kept' })
        expect(plan?.followupPrompt).toBeNull()
      }
    }
  )

  it.each(['posix', 'powershell', 'cmd'] as const)(
    'reuses an existing run message separator in %s',
    (shell) => {
      const plan = buildAgentStartupPlan({
        agent: 'opencode',
        prompt: '--literal task',
        cmdOverrides: { opencode: 'opencode run --standalone --' },
        platform: shell === 'posix' ? 'linux' : 'win32',
        shell
      })
      const parsed = tokenizeStartupCommand(plan?.launchCommand ?? '', shell)
      expect(parsed.ok).toBe(true)
      if (!parsed.ok) {
        throw new Error(parsed.error)
      }
      expect(parsed.tokens).toEqual(['opencode', 'run', '--standalone', '--', '--literal task'])
      expect(plan?.env).toBeUndefined()
    }
  )

})

describe('wrapped OpenCode run startup', () => {
  it.each(['opencode', 'opencode2'] as const)(
    'keeps %s run flags and positional task behind POSIX prefixes',
    (agent) => {
      for (const command of [
        'CUSTOM_CONFIG=private opencode run --standalone',
        'env CUSTOM_CONFIG=private opencode run --standalone',
        'env -- CUSTOM_CONFIG=private opencode run --standalone',
        'env -- CUSTOM_CONFIG=private opencode run --standalone --',
        'env CUSTOM_CONFIG=private opencode run --title "--"'
      ]) {
        const plan = buildAgentStartupPlan({
          agent,
          prompt: '--literal task',
          cmdOverrides: { [agent]: command },
          platform: 'linux',
          shell: 'posix',
          isRemote: true,
          agentEnv: { CUSTOM_CONFIG: 'kept' }
        })
        expect(plan?.launchCommand).toBe(
          command.endsWith(' --') ? `${command} '--literal task'` : `${command} -- '--literal task'`
        )
        expect(plan?.env).toEqual({ CUSTOM_CONFIG: 'kept' })
        expect(plan?.followupPrompt).toBeNull()
      }
    }
  )

  it.each(['opencode', 'opencode2'] as const)(
    'preserves %s PowerShell call syntax and its run separator',
    (agent) => {
      for (const separator of ['', ' --']) {
        const command = `& "C:\\Program Files\\opencode\\opencode.exe" --log-level debug run --standalone${separator}`
        const plan = buildAgentStartupPlan({
          agent,
          prompt: "--task's é",
          cmdOverrides: { [agent]: command },
          platform: 'win32',
          shell: 'powershell',
          agentEnv: { CUSTOM_CONFIG: 'kept' }
        })
        expect(plan?.launchCommand).toBe(`${command}${separator ? ' ' : ' -- '}'--task''s é'`)
        expect(plan?.env).toEqual({ CUSTOM_CONFIG: 'kept' })
        expect(plan?.followupPrompt).toBeNull()
      }
    }
  )
})
