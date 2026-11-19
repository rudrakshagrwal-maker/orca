// @vitest-environment happy-dom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useSidebarAgentUsage } from './use-sidebar-agent-usage'

const mocks = vi.hoisted(() => ({
  visible: true,
  owner: {
    target: { kind: 'local' } as { kind: 'local' } | { kind: 'environment'; environmentId: string },
    wslHostDistro: null as string | null
  },
  call: vi.fn()
}))
vi.mock('@/hooks/use-window-stream-visibility', () => ({
  useWindowStreamVisible: () => mocks.visible
}))
vi.mock('@/runtime/provider-accounts/ownership/use-active-account-owner', () => ({
  useActiveAccountOwner: () => mocks.owner
}))
vi.mock('@/runtime/rpc/calls/runtime-rpc-call', () => ({ callRuntimeRpc: mocks.call }))
vi.mock('@/store/index', () => ({
  useAppStore: (select: (state: unknown) => unknown) => select({ settings: {} })
}))

beforeEach(() => {
  vi.useFakeTimers()
  mocks.visible = true
  mocks.owner = { target: { kind: 'local' }, wslHostDistro: null }
  mocks.call.mockReset().mockResolvedValue({ rateLimits: { claude: { status: 'ok' } } })
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

it('defers quota reads for fifteen minutes and pauses them while hidden', async () => {
  const { result, rerender } = renderHook(useSidebarAgentUsage)
  await act(() => vi.advanceTimersByTimeAsync(899_999))
  expect(mocks.call).not.toHaveBeenCalled()
  await act(() => vi.advanceTimersByTimeAsync(1))
  expect(result.current?.claude?.status).toBe('ok')
  mocks.call.mockClear()
  mocks.visible = false
  rerender()
  await act(() => vi.advanceTimersByTimeAsync(1_800_000))
  expect(mocks.call).not.toHaveBeenCalled()
  mocks.visible = true
  rerender()
  expect(mocks.call).not.toHaveBeenCalled()
  await act(() => vi.advanceTimersByTimeAsync(900_000))
  expect(mocks.call).toHaveBeenCalledWith(
    { kind: 'local' },
    'accounts.list',
    { refreshUsage: true },
    expect.anything()
  )
})

it('never displays one host snapshot under another host and discards late replies', async () => {
  let resolve!: (value: unknown) => void
  mocks.call.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done
      })
  )
  const { result, rerender } = renderHook(useSidebarAgentUsage)
  await act(() => vi.advanceTimersByTimeAsync(900_000))
  mocks.owner = { target: { kind: 'environment', environmentId: 'remote-b' }, wslHostDistro: null }
  rerender()
  await act(async () => {
    resolve({ rateLimits: { claude: { status: 'ok' } } })
  })
  expect(result.current).toBeNull()
  await act(() => vi.advanceTimersByTimeAsync(900_000))
  expect(mocks.call).toHaveBeenLastCalledWith(
    { kind: 'environment', environmentId: 'remote-b' },
    'accounts.list',
    { refreshUsage: true },
    expect.anything()
  )
})

it('reads a WSL host account from its owning desktop distro', async () => {
  mocks.owner.wslHostDistro = 'Ubuntu'
  renderHook(useSidebarAgentUsage)
  await act(() => vi.advanceTimersByTimeAsync(900_000))
  expect(mocks.call).toHaveBeenCalledWith(
    { kind: 'local' },
    'accounts.list',
    {
      refreshUsage: true,
      usageTarget: { runtime: 'wsl', wslDistro: 'Ubuntu' }
    },
    expect.anything()
  )
})
