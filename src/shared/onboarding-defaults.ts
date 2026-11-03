import type { OnboardingChecklistState, OnboardingState } from './onboarding-state-types'

// Share the final wizard step across backfill, clamps and UI.
export const ONBOARDING_FINAL_STEP = 5
export const ONBOARDING_FLOW_VERSION = 4

export function getDefaultOnboardingState(): OnboardingState {
  return {
    flowVersion: ONBOARDING_FLOW_VERSION,
    // RA: first launch opens the normal app without a wizard or checklist.
    closedAt: 0,
    outcome: 'completed',
    lastCompletedStep: ONBOARDING_FINAL_STEP,
    checklist: {
      addedRepo: false,
      choseAgent: false,
      ranFirstAgent: false,
      ranSecondAgentOnSameTask: false,
      triedCmdJ: false,
      shapedSidebar: false,
      reviewedDiff: false,
      openedPr: false,
      addedFolder: false,
      openedFile: false,
      ranAgentOnFile: false,
      dismissed: true
    } satisfies OnboardingChecklistState
  }
}
