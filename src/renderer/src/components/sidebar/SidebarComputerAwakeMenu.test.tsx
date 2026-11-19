// @vitest-environment happy-dom
import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { ComputerAwakeStatus } from '../../../../shared/computer-awake-mode'
import { TooltipProvider } from '@/components/ui/tooltip'
import SidebarToolbar from './SidebarToolbar'

const mocks = vi.hoisted(() => ({ updateSettings: vi.fn() }))
vi.mock('@/store/index', () => ({
  useAppStore: (select: (state: unknown) => unknown) =>
    select({ updateSettingsOrThrow: mocks.updateSettings })
}))
vi.mock('./SidebarSettingsHelpMenu', () => ({ SidebarSettingsHelpMenu: () => null }))
vi.mock('./worktree-list/navigation/ScrollToCurrentWorkspaceToolbarButton', () => ({
  ScrollToCurrentWorkspaceToolbarButton: () => null
}))

const originalApi = window.api
const getStatus = vi.fn<() => Promise<ComputerAwakeStatus>>()
const unsubscribe = vi.fn()
let onStatus: (status: ComputerAwakeStatus) => void

beforeEach(() => {
  mocks.updateSettings.mockReset().mockResolvedValue(undefined)
  getStatus.mockReset().mockResolvedValue({ mode: 'off', active: false })
  unsubscribe.mockClear()
  Object.defineProperty(window, 'api', {
    configurable: true,
    value: {
      agentAwake: {
        getStatus,
        onChanged: (listener: typeof onStatus) => {
          onStatus = listener
          return unsubscribe
        }
      }
    }
  })
})

afterEach(() => {
  cleanup()
  Object.defineProperty(window, 'api', { configurable: true, value: originalApi })
})

function renderControl() {
  return render(
    <TooltipProvider>
      <SidebarToolbar />
    </TooltipProvider>
  )
}

it('switches all three modes through the existing settings writer and checks the service mode', async () => {
  const user = userEvent.setup()
  renderControl()
  await user.click(await screen.findByRole('button', { name: 'Keep computer awake: Off' }))
  expect(screen.getByRole('menuitemradio', { name: 'Off', checked: true })).toBeTruthy()

  getStatus.mockResolvedValueOnce({ mode: 'on', active: true })
  await user.click(screen.getByRole('menuitemradio', { name: 'Always' }))
  expect(mocks.updateSettings).toHaveBeenLastCalledWith({
    computerAwakeMode: 'on',
    keepComputerAwakeWhileAgentsRun: true
  })
  await user.click(await screen.findByRole('button', { name: 'Keep computer awake: Always' }))
  expect(screen.getByRole('menuitemradio', { name: 'Always', checked: true })).toBeTruthy()

  getStatus.mockResolvedValueOnce({ mode: 'auto', active: false })
  await user.click(screen.getByRole('menuitemradio', { name: 'While agents work' }))
  expect(mocks.updateSettings).toHaveBeenLastCalledWith({
    computerAwakeMode: 'auto',
    keepComputerAwakeWhileAgentsRun: true
  })
  await user.click(
    await screen.findByRole('button', { name: 'Keep computer awake: While agents work' })
  )
  expect(
    screen.getByRole('menuitemradio', { name: 'While agents work', checked: true })
  ).toBeTruthy()

  getStatus.mockResolvedValueOnce({ mode: 'off', active: false })
  await user.click(screen.getByRole('menuitemradio', { name: 'Off' }))
  expect(mocks.updateSettings).toHaveBeenLastCalledWith({
    computerAwakeMode: 'off',
    keepComputerAwakeWhileAgentsRun: false
  })
  await user.click(await screen.findByRole('button', { name: 'Keep computer awake: Off' }))
  expect(screen.getByRole('menuitemradio', { name: 'Off', checked: true })).toBeTruthy()
})

it('keeps a pushed service change when the initial status request arrives late', async () => {
  let resolveInitial!: (status: ComputerAwakeStatus) => void
  getStatus.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveInitial = resolve
      })
  )
  const { unmount } = renderControl()
  act(() => onStatus({ mode: 'auto', active: true }))
  await act(async () => resolveInitial({ mode: 'off', active: false }))
  expect(
    screen.getByRole('button', { name: 'Keep computer awake: While agents work' })
  ).toBeTruthy()
  unmount()
  expect(unsubscribe).toHaveBeenCalled()
})
