// @vitest-environment happy-dom
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { i18n } from '@/i18n/i18n'

vi.mock('./use-status-bar-controller', () => ({
  useStatusBarController: () => ({
    anyVisible: true,
    isEmptyUsageState: false,
    rosterProviders: [],
    collapsedUsageProviders: [],
    statusBarUsageMode: 'compact',
    usagePercentageDisplay: 'used',
    handleRefresh: vi.fn()
  })
}))
vi.mock('./CaffeinateStatusSegment', () => ({ CaffeinateStatusSegment: () => null }))
vi.mock('./RemoteServerUpdateStatusSegment', () => ({
  RemoteServerUpdateStatusSegment: () => null
}))
vi.mock('./SkillUpdateStatusSegment', () => ({ SkillUpdateStatusSegment: () => null }))
vi.mock('./NativeChatResumeStatusSegment', () => ({ NativeChatResumeStatusSegment: () => null }))
vi.mock('./UpdateStatusSegment', () => ({ UpdateStatusSegment: () => null }))
vi.mock('./StatusBarVisibilityMenu', () => ({ StatusBarVisibilityMenu: () => null }))

import { StatusBar } from './StatusBar'
import { TooltipProvider } from '@/components/ui/tooltip'

beforeEach(async () => {
  await i18n.changeLanguage('en')
})
afterEach(async () => {
  cleanup()
  await i18n.changeLanguage('en')
})

it('keeps quota controls in the sidebar when the language changes', async () => {
  const view = render(
    <TooltipProvider>
      <StatusBar floatingTerminalOpen={false} />
    </TooltipProvider>
  )
  const statusBar = view.container.querySelector('[data-orca-status-bar]')
  expect(statusBar).not.toBeNull()
  expect(screen.queryByRole('button', { name: 'Refresh rate limits' })).toBeNull()

  await act(async () => {
    await i18n.changeLanguage('ja')
  })

  expect(view.container.querySelector('[data-orca-status-bar]')).toBe(statusBar)
  expect(view.container.querySelector('.status-bar-usage-cluster')).toBeNull()

  await act(async () => {
    await i18n.changeLanguage('en')
  })
  expect(screen.queryByRole('button', { name: 'Refresh rate limits' })).toBeNull()
})
