import { getDefaultOnboardingState } from './onboarding-defaults'
import type { OnboardingState } from './onboarding-state-types'

// RA: retained wizard tests opt into unfinished state; production starts completed.
export function createUnfinishedOnboardingState(): OnboardingState {
  const state = getDefaultOnboardingState()
  return {
    ...state,
    closedAt: null,
    outcome: null,
    lastCompletedStep: -1,
    checklist: { ...state.checklist, dismissed: false }
  }
}
