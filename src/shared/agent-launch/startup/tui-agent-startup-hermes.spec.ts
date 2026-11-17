import { describe, expect, it } from 'vitest'
import { buildAgentStartupPlan } from './tui-agent-startup'
import {
  unwrapPowerShellScript
} from './tui-agent-startup-script.test-fixture'

// Hermes owns startup query/TUI/subcommand flag placement; keep its token-rewrite cases together.

describe('hermes startup plans', () => {
  it.each([
    {
      shell: 'powershell' as const,
      override: '"C:\\Program Files\\Hermes\\hermes.exe" --tui',
      expected: "& 'C:\\Program Files\\Hermes\\hermes.exe' 'chat'"
    },
    {
      shell: 'cmd' as const,
      override: 'C:\\Tools\\hermes.exe --tui',
      expected: "& 'C:\\Tools\\hermes.exe' 'chat'"
    }
  ])('preserves Windows paths in Hermes command overrides on $shell', (testCase) => {
    const plan = buildAgentStartupPlan({
      agent: 'hermes',
      prompt: 'run it',
      cmdOverrides: { hermes: testCase.override },
      platform: 'win32',
      shell: testCase.shell
    })

    expect(unwrapPowerShellScript(plan?.launchCommand)).toContain(testCase.expected)
  })












})
