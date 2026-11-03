// @vitest-environment happy-dom
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useSidebarAgentSectionResize } from './use-sidebar-agent-section-resize'

const state = vi.hoisted(() => ({
  sidebarAgentsHeight: null as number | null,
  setSidebarAgentsHeight: vi.fn()
}))
vi.mock('@/store', () => ({ useAppStore: (selector: (value: typeof state) => unknown) => selector(state) }))

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks() })

// RA: test actual pointer capture, bound writes, reset and observer cleanup without a native window.
describe('Agents section height splitter', () => {
  it('grows upwards, clamps both ends, resets and disconnects its observer', () => {
    let resize: ReturnType<typeof useSidebarAgentSectionResize> | undefined
    const disconnect = vi.fn()
    vi.stubGlobal('ResizeObserver', class {
      observe = vi.fn()
      disconnect = disconnect
    })
    function Fixture() {
      resize = useSidebarAgentSectionResize()
      return <div ref={(node) => {
        if (node) { Object.defineProperty(node, 'clientHeight', { value: 600, configurable: true }) }
      }}><div ref={(node) => {
        resize!.sectionRef.current = node
        if (node) { Object.defineProperty(node, 'offsetHeight', { value: 180, configurable: true }) }
      }} /></div>
    }
    const mounted = render(<Fixture />)
    if (!resize) { throw new Error('Splitter did not mount') }
    const handle = {
      setPointerCapture: vi.fn(), hasPointerCapture: () => true, releasePointerCapture: vi.fn()
    }
    const event = (clientY: number) => ({ button: 0, clientY, pointerId: 1,
      currentTarget: handle, preventDefault: vi.fn() }) as unknown as React.PointerEvent<HTMLDivElement>
    act(() => { resize!.handleProps.onPointerDown(event(300)); resize!.handleProps.onPointerMove(event(0)) })
    expect(state.setSidebarAgentsHeight).toHaveBeenLastCalledWith(480)
    expect(handle.setPointerCapture).toHaveBeenCalledWith(1)
    act(() => resize!.handleProps.onPointerMove(event(-10_000)))
    expect(state.setSidebarAgentsHeight).toHaveBeenLastCalledWith(544)
    act(() => { resize!.handleProps.onPointerMove(event(10_000)); resize!.handleProps.onPointerUp(event(10_000)) })
    expect(state.setSidebarAgentsHeight).toHaveBeenLastCalledWith(90)
    expect(handle.releasePointerCapture).toHaveBeenCalledWith(1)
    act(() => resize!.handleProps.onDoubleClick())
    expect(state.setSidebarAgentsHeight).toHaveBeenLastCalledWith(null)
    mounted.unmount()
    expect(disconnect).toHaveBeenCalledTimes(1)
  })
})
