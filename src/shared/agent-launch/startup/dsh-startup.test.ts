import { describe, expect, it } from 'vitest'
import { buildAgentStartupPlan } from './tui-agent-startup'
import { buildAgentResumeStartupPlan } from './tui-agent-resume-startup'

describe('DeepSeek Harness terminal launches', () => {
  it.each(['win32', 'linux', 'darwin'] as const)(
    'opens the installed harness terminal profile and delivers prompts after startup on %s',
    (platform) => {
      const plan = buildAgentStartupPlan({
        agent: 'dsh',
        prompt: 'inspect this project',
        platform,
        cmdOverrides: {}
      })

      expect(plan?.launchCommand).toBe('dsh --profile dsh-tui')
      expect(plan?.expectedProcess).toBe('dsh')
      expect(plan?.followupPrompt).toBe('inspect this project')
    }
  )

  it('resumes through the same profile without a dsh-tui executable', () => {
    const plan = buildAgentResumeStartupPlan({
      agent: 'dsh',
      providerSession: { key: 'session_id', id: 'dsh-session' },
      platform: 'linux',
      cmdOverrides: {}
    })

    expect(plan?.launchCommand).toBe("dsh --profile dsh-tui '--resume' 'dsh-session'")
  })
})
