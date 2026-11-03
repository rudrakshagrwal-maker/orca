import { useCallback, useMemo, useState } from 'react'
import type { OnboardingState } from '../../../shared/onboarding-state-types'

export type OnboardingGate = ReturnType<typeof useOnboardingAndFeatureTips>

// RA: retain hydration's contract without starting first-run flows, tips or experiments.
export function useOnboardingAndFeatureTips() {
  const [onboarding, setOnboarding] = useState<OnboardingState | null>(null)
  const [chatUiHereCornerCardOpen, setChatUiHereCornerCardOpen] = useState(false)
  const applyStartupOnboardingState = useCallback((state: OnboardingState): void => {
    setOnboarding(state)
  }, [])

  return useMemo(
    () => ({
      applyStartupOnboardingState,
      onboarding,
      setOnboarding,
      shouldRender: false,
      chatUiHereCornerCardOpen,
      setChatUiHereCornerCardOpen
    }),
    [applyStartupOnboardingState, onboarding, chatUiHereCornerCardOpen]
  )
}
