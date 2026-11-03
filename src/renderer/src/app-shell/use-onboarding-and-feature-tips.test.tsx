// @vitest-environment happy-dom

import { act, renderHook } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { getDefaultOnboardingState } from '../../../shared/onboarding-defaults'
import { useOnboardingAndFeatureTips } from './use-onboarding-and-feature-tips'

// RA: even an unfinished old profile must not activate first-run education.
it.each([null, 0])('hydrates onboarding with closedAt=%s without prompts or probes', (closedAt) => {
  const probe = vi.fn()
  Object.defineProperty(window, 'api', { configurable: true, get: probe })
  const { result } = renderHook(() => useOnboardingAndFeatureTips())
  act(() => {
    result.current.applyStartupOnboardingState({ ...getDefaultOnboardingState(), closedAt })
  })
  expect(result.current.onboarding?.closedAt).toBe(closedAt)
  expect(result.current.shouldRender).toBe(false)
  expect(result.current.chatUiHereCornerCardOpen).toBe(false)
  expect(probe).not.toHaveBeenCalled()
})
