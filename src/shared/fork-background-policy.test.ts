import { expect, it } from 'vitest'
import { backgroundJobsDisabled, preserveGlobalAgentConfiguration } from './fork-background-policy'
import { isAgentStatusHooksEnabled } from './agent-status-hooks-setting'
import { getDefaultSettings } from './constants'
import { getDefaultOnboardingState, ONBOARDING_FINAL_STEP } from './onboarding-defaults'
import { normalizePluginSystemEnabledDefaultOn } from './plugins/plugin-system-settings'

// RA: these checks use the real immutable fork policy, without the legacy unit-test mock.
it('disables collection and config writes even when an old profile enabled hooks/plugins', () => {
  expect(backgroundJobsDisabled()).toBe(true)
  expect(preserveGlobalAgentConfiguration()).toBe(true)
  expect(isAgentStatusHooksEnabled({ agentStatusHooksEnabled: true })).toBe(false)
  expect(
    normalizePluginSystemEnabledDefaultOn({
      pluginSystemEnabled: true,
      pluginSystemDefaultedOn: true
    }).pluginSystemEnabled
  ).toBe(false)
  expect(getDefaultSettings('/tmp')).toMatchObject({
    agentStatusHooksEnabled: false,
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
