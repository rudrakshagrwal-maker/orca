import { beforeEach, expect, it, vi } from 'vitest'
import { makeCloseTestTab, preparePendingSplitClose } from './pending-split-close-test-fixture'
import type { sendLayoutCommandToOwner } from '@/runtime/layout-owner-command'
import { LOCAL_LAYOUT_APPLY_ORIGIN } from '@/runtime/server-layout-apply-routes'
import { flushPtySideEffects } from './pty-transport-test-harness'
import type { PtyRunningWorkProbe } from '../terminal/pty-running-work-probe'

const mocks = vi.hoisted(() => ({
  layoutOwnerIsMain: false,
  commitTerminalSurfaceClose: vi.fn(),
  sendLayoutCommandToOwner: vi.fn<typeof sendLayoutCommandToOwner>()
}))

vi.mock('../../../../shared/layout-owner-switch', () => ({
  get ORCA_LAYOUT_OWNER_IS_MAIN() {
    return mocks.layoutOwnerIsMain
  }
}))
vi.mock('@/runtime/layout-owner-command', () => ({
  sendLayoutCommandToOwner: mocks.sendLayoutCommandToOwner
}))
vi.mock('@/store/terminals/terminal-surface-close-intent', () => ({
  commitTerminalSurfaceClose: mocks.commitTerminalSurfaceClose
}))

const LEAF = '11111111-1111-4111-8111-111111111111'

beforeEach(() => {
  mocks.layoutOwnerIsMain = false
  mocks.commitTerminalSurfaceClose.mockReset()
  mocks.sendLayoutCommandToOwner.mockReset()
  mocks.sendLayoutCommandToOwner.mockReturnValue(true)
})

it('a window-owned build closes the pane at once and reports it to main', async () => {
  const p = await preparePendingSplitClose()

  p.actions.executeClosePane(1)

  expect(mocks.sendLayoutCommandToOwner).not.toHaveBeenCalled()
  expect(mocks.commitTerminalSurfaceClose).toHaveBeenCalledWith('workspace', {
    kind: 'pane',
    tabId: 'tab-parent',
    leafId: LEAF
  })
  expect(p.transports.has(1)).toBe(false)
})

it('a layout-owner build removes the pane only once main’s frame drops it', async () => {
  mocks.layoutOwnerIsMain = true
  const p = await preparePendingSplitClose()
  const intents = await import('@/runtime/layout-owner-pane-intents')
  ;(await import('@/runtime/layout-frame-position')).noteLayoutFramePosition(1)

  p.actions.executeClosePane(1)

  expect(mocks.sendLayoutCommandToOwner).toHaveBeenCalledWith(
    'workspace',
    { type: 'closePane', tabId: 'tab-parent', leafId: LEAF },
    {
      apply: expect.any(Function),
      asToday: expect.any(Function),
      refused: expect.any(Function)
    }
  )
  mocks.sendLayoutCommandToOwner.mock.calls[0]?.[2].apply({}, LOCAL_LAYOUT_APPLY_ORIGIN)
  expect(p.transports.has(1)).toBe(true)

  // The frame without the pane finds the window's close and runs it.
  expect(intents.takePaneCloseIntent('tab-parent', LEAF)).toBe('user')
  p.actions.closePaneLocally(1, LEAF)

  expect(p.transports.has(1)).toBe(false)
  expect(mocks.commitTerminalSurfaceClose).not.toHaveBeenCalled()
})

it('a layout-owner build closes the pane itself when main closed it and no frame is coming', async () => {
  mocks.layoutOwnerIsMain = true
  const p = await preparePendingSplitClose()
  ;(await import('@/runtime/layout-frame-position')).endLayoutFramePositions()

  p.actions.executeClosePane(1)
  mocks.sendLayoutCommandToOwner.mock.calls[0]?.[2].apply({}, LOCAL_LAYOUT_APPLY_ORIGIN)

  expect(p.transports.has(1)).toBe(false)
  expect(mocks.commitTerminalSurfaceClose).not.toHaveBeenCalled()
})

it('a layout-owner build closes the pane itself when main holds no such pane, so no frame drops it', async () => {
  mocks.layoutOwnerIsMain = true
  const p = await preparePendingSplitClose()
  ;(await import('@/runtime/layout-frame-position')).noteLayoutFramePosition(1)

  p.actions.executeClosePane(1)
  mocks.sendLayoutCommandToOwner.mock.calls[0]?.[2].apply(
    { alreadyClosed: true },
    LOCAL_LAYOUT_APPLY_ORIGIN
  )

  const intents = await import('@/runtime/layout-owner-pane-intents')
  expect(intents.takePaneCloseIntent('tab-parent', LEAF)).toBeNull()
  expect(p.transports.has(1)).toBe(false)
  expect(mocks.commitTerminalSurfaceClose).not.toHaveBeenCalled()
})

it('a layout-owner build closes as today, forgetting its close, when main lacks the pane', async () => {
  mocks.layoutOwnerIsMain = true
  const p = await preparePendingSplitClose()

  p.actions.executeClosePane(1)
  mocks.sendLayoutCommandToOwner.mock.calls[0]?.[2].asToday()

  const intents = await import('@/runtime/layout-owner-pane-intents')
  expect(intents.takePaneCloseIntent('tab-parent', LEAF)).toBeNull()
  expect(mocks.commitTerminalSurfaceClose).toHaveBeenCalledOnce()
  expect(p.transports.has(1)).toBe(false)
})

// RA: delayed explicit closes still close the last tab.
it.each([1, 2])('handles last-pane refusal with %s workspace tabs', async (tabCount) => {
  mocks.layoutOwnerIsMain = true
  const p = await preparePendingSplitClose()
  if (tabCount > 1) {
    p.state.tabsByWorktree.workspace.push(makeCloseTestTab('survivor', null))
  }
  p.actions.executeClosePane(1)
  p.actions.executeClosePane(2)
  const [first, second] = mocks.sendLayoutCommandToOwner.mock.calls.map(([, , on]) => on)

  // Main took pane 1; its frame is still on the way when main refuses pane 2 as its last.
  ;(await import('@/runtime/layout-frame-position')).noteLayoutFramePosition(1)
  first?.apply({}, LOCAL_LAYOUT_APPLY_ORIGIN)
  second?.refused?.('last_pane')

  expect(p.controller.onCloseTab).toHaveBeenCalledTimes(1)
})

// RA: main may answer after a sibling closes or the workspace loses its other tab.
it.each(['last_pane', 'compatibility', 'frame'] as const)(
  'rechecks keyboard last-tab protection after a delayed %s reply', async (reply) => {
    mocks.layoutOwnerIsMain = true
    const p = await preparePendingSplitClose()
    p.state.tabsByWorktree.workspace.push(makeCloseTestTab('other-tab', null))
    p.actions.executeClosePane(1, 'keyboard')
    p.actions.executeClosePane(2, 'keyboard')
    p.state.tabsByWorktree.workspace.pop()
    const [first, second] = mocks.sendLayoutCommandToOwner.mock.calls.map(([, , on]) => on)
    ;(await import('@/runtime/layout-frame-position')).noteLayoutFramePosition(1)
    first?.apply({}, LOCAL_LAYOUT_APPLY_ORIGIN)
    if (reply === 'last_pane') {
      second?.refused?.('last_pane')
    } else {
      const manager = p.controller.managerRef.current
      if (!manager) throw new Error('Missing test pane manager')
      const survivor = manager.getPanes().find((pane) => pane.id === 2)
      if (!survivor) throw new Error('Missing surviving pane')
      vi.spyOn(manager, 'getPanes').mockReturnValue([survivor])
      if (reply === 'compatibility') second?.asToday()
      else p.actions.closePaneLocally(2, p.siblingLeafId)
    }
    expect(p.controller.onCloseTab).not.toHaveBeenCalled()
  }
)

it('allows a delayed keyboard fallback when another workspace tab still exists', async () => {
  mocks.layoutOwnerIsMain = true
  const p = await preparePendingSplitClose()
  p.state.tabsByWorktree.workspace.push(makeCloseTestTab('other-tab', null))
  p.actions.executeClosePane(1, 'keyboard')
  p.actions.executeClosePane(2, 'keyboard')
  const [first, second] = mocks.sendLayoutCommandToOwner.mock.calls.map(([, , on]) => on)
  ;(await import('@/runtime/layout-frame-position')).noteLayoutFramePosition(1)
  first?.apply({}, LOCAL_LAYOUT_APPLY_ORIGIN)
  second?.refused?.('last_pane')
  expect(p.controller.onCloseTab).toHaveBeenCalledOnce()
})

// RA: running-process admission must carry keyboard intent into the later main reply too.
it('retains keyboard protection across an outstanding running-work probe', async () => {
  mocks.layoutOwnerIsMain = true
  const p = await preparePendingSplitClose()
  const { probePtyRunningWork } = await import('../terminal/pty-running-work-probe')
  const probe = Promise.withResolvers<PtyRunningWorkProbe[]>()
  vi.mocked(probePtyRunningWork).mockReturnValueOnce(probe.promise)
  p.actions.handleRequestClosePane(1, 'keyboard')
  p.actions.executeClosePane(2, 'keyboard')
  probe.resolve([{ ptyId: 'pty-restored', verdict: 'exited', timedOut: false, remote: false }])
  await flushPtySideEffects()
  expect(mocks.sendLayoutCommandToOwner).toHaveBeenCalledTimes(2)
  const [first, second] = mocks.sendLayoutCommandToOwner.mock.calls.map(([, , on]) => on)
  ;(await import('@/runtime/layout-frame-position')).noteLayoutFramePosition(1)
  first?.apply({}, LOCAL_LAYOUT_APPLY_ORIGIN)
  second?.refused?.('last_pane')
  expect(p.controller.onCloseTab).not.toHaveBeenCalled()
})

it('explicit Close closes the last terminal tab', async () => {
  const p = await preparePendingSplitClose()
  const manager = p.controller.managerRef.current!
  const lastPane = manager.getPanes()[0]
  vi.spyOn(manager, 'getPanes').mockReturnValue([lastPane])
  p.actions.handleRequestClosePane(1)
  expect(p.controller.onCloseTab).toHaveBeenCalledOnce()
})

it('a layout-owner build leaves an unmounted tab alone when main refuses its last pane', async () => {
  mocks.layoutOwnerIsMain = true
  const p = await preparePendingSplitClose()
  p.actions.executeClosePane(1)
  p.controller.managerRef.current = null

  mocks.sendLayoutCommandToOwner.mock.calls[0]?.[2].refused?.('last_pane')

  expect(p.controller.onCloseTab).not.toHaveBeenCalled()
})

it('a layout-owner build closes as today when main calls it the last pane but the window has more', async () => {
  mocks.layoutOwnerIsMain = true
  const p = await preparePendingSplitClose()
  p.actions.executeClosePane(1)

  mocks.sendLayoutCommandToOwner.mock.calls[0]?.[2].refused?.('last_pane')

  expect(p.controller.onCloseTab).not.toHaveBeenCalled()
  expect(mocks.commitTerminalSurfaceClose).toHaveBeenCalledOnce()
  expect(p.transports.has(1)).toBe(false)
})
