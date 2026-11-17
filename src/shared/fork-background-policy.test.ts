import { expect, it } from 'vitest'
import { getDefaultOnboardingState, ONBOARDING_FINAL_STEP } from './onboarding-defaults'
// RA: these checks use the real immutable fork policy, without the legacy unit-test mock.

it('starts directly in the normal application with onboarding complete', () => {
  expect(getDefaultOnboardingState()).toMatchObject({
    closedAt: 0,
    outcome: 'completed',
    lastCompletedStep: ONBOARDING_FINAL_STEP,
    checklist: { dismissed: true }
  })
})
