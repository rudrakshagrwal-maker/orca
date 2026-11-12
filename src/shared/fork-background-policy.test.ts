import { expect, it } from 'vitest'
import { backgroundJobsDisabled, preserveGlobalAgentConfiguration } from './fork-background-policy'
import { isAgentStatusHooksEnabledForAgent } from './agent-hook-listener/configuration/agent-status-hooks-setting'
import { getDefaultSettings } from './constants'
import { getDefaultOnboardingState, ONBOARDING_FINAL_STEP } from './onboarding-defaults'
import { normalizePluginSystemEnabledDefaultOn } from './plugins/plugin-system-settings'

// RA: these checks use the real immutable fork policy, without the legacy unit-test mock.
it('disables collection and config writes even when an old profile enabled hooks/plugins', () => {
  expect(backgroundJobsDisabled()).toBe(true)
  expect(preserveGlobalAgentConfiguration()).toBe(true)
  // RA: the approved Claude observer is the sole per-agent exception.
  expect(isAgentStatusHooksEnabledForAgent({ agentStatusHooksEnabled: true }, 'claude')).toBe(true)
  expect(isAgentStatusHooksEnabledForAgent({ agentStatusHooksEnabled: true }, 'codex')).toBe(false)
  expect(
    normalizePluginSystemEnabledDefaultOn({
      pluginSystemEnabled: true,
      pluginSystemDefaultedOn: true
    }).pluginSystemEnabled
  ).toBe(false)
  expect(getDefaultSettings('/tmp')).toMatchObject({
    agentStatusHooksEnabled: true,
    pluginSystemEnabled: false,
    showMobileButton: false
  })
})

it('starts directly in the normal application with onboarding complete', () => {
  expect(getDefaultOnboardingState()).toMatchObject({
    closedAt: 0,
    outcome: 'completed',
    lastCompletedStep: ONBOARDING_FINAL_STEP,
    checklist: { dismissed: true }
  })
})
