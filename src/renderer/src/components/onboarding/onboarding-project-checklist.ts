import type { OnboardingState } from '../../../../shared/onboarding-state-types'

export type OnboardingProjectChecklistItem = 'addedRepo' | 'addedFolder'

// RA: onboarding is removed, so adding a project records no checklist progress.
export async function markOnboardingProjectAdded(
  _item: OnboardingProjectChecklistItem
): Promise<OnboardingState | null> {
  return null
}
