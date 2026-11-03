// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useTabStripOverflowNavigation } from './tab-strip-overflow-navigation'

import { useTabStripPointerActivation } from './tab-strip-pointer-activation'
import { isTabStripPointerGestureActive } from './tab-strip-pointer-gesture'

const TAB_WIDTH = 100
let viewportWidth = 300
let notifyResize = (): void => {}

const scrollLeftByElement = new WeakMap<Element, number>()
const originals = {
  rect: HTMLElement.prototype.getBoundingClientRect,
  scrollIntoView: HTMLElement.prototype.scrollIntoView,
  scrollLeft: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollLeft'),
  scrollWidth: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollWidth'),
  clientWidth: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth')
}

function isStrip(el: Element): boolean {
  return el.hasAttribute('data-strip')
}

function rect(left: number, width: number): DOMRect {
  return DOMRect.fromRect({ x: left, y: 0, width, height: 20 })
}

// RA: Model natural slot geometry; active tabs are never sticky.
function installStripLayout(): void {
  viewportWidth = 300
  // RA: Drive the real resize handler deterministically without browser layout.
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: ResizeObserverCallback) {
        notifyResize = () => callback([], this as unknown as ResizeObserver)
      }
      observe(): void {}
      disconnect(): void {}
      unobserve(): void {}
    }
  )
  Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
    configurable: true,
    get(this: Element) {
      return isStrip(this) ? this.children.length * TAB_WIDTH : 0
    }
  })
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get(this: Element) {
      return isStrip(this) ? viewportWidth : 0
    }
  })
  Object.defineProperty(HTMLElement.prototype, 'scrollLeft', {
    configurable: true,
    get(this: Element) {
      return scrollLeftByElement.get(this) ?? 0
    },
    set(this: Element, value: number) {
      const max = Math.max(0, this.scrollWidth - this.clientWidth)
      scrollLeftByElement.set(this, Math.min(max, Math.max(0, value)))
    }
  })
  HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement): DOMRect {
    if (isStrip(this)) {
      return rect(0, viewportWidth)
    }
    const strip = this.parentElement
    if (strip && isStrip(strip)) {
      const index = Array.from(strip.children).indexOf(this)
      const left = index * TAB_WIDTH - strip.scrollLeft
      return rect(left, TAB_WIDTH)
    }
    return rect(0, 0)
  }
  HTMLElement.prototype.scrollIntoView = vi.fn(function (this: HTMLElement): void {
    const strip = this.parentElement
    if (!strip || !isStrip(strip)) return
    const { left, right } = this.getBoundingClientRect()
    if (left < 0) strip.scrollLeft += left
    else if (right > viewportWidth) strip.scrollLeft += right - viewportWidth
  })
}

function restoreStripLayout(): void {
  vi.unstubAllGlobals()
  HTMLElement.prototype.getBoundingClientRect = originals.rect
  HTMLElement.prototype.scrollIntoView = originals.scrollIntoView
  for (const key of ['scrollLeft', 'scrollWidth', 'clientWidth'] as const) {
    const descriptor = originals[key]
    if (descriptor) {
      Object.defineProperty(HTMLElement.prototype, key, descriptor)
    } else {
      Reflect.deleteProperty(HTMLElement.prototype, key)
    }
  }
}

const NO_HOSTED_ROWS: string[] = []
let stripRenderCount = 0
let subscribeToStripResize: ((listener: () => void) => () => void) | null = null

/** `hostedRows` render like client-hosted browser rows: a strip slot with no `data-tab-id`. */
function Strip({
  tabs,
  active,
  hostedRows = NO_HOSTED_ROWS,
  activeHostedRow = null
}: {
  tabs: string[]
  active: string
  hostedRows?: string[]
  activeHostedRow?: string | null
}): React.JSX.Element {
  stripRenderCount++
  const activation = useTabStripPointerActivation({ onActivate: () => {} })
  const navigation = useTabStripOverflowNavigation({
    activeVisibleTabId: active,
    activeSlotId: activeHostedRow ?? active,
    layoutKey: [...tabs, ...hostedRows].join(','),
    worktreeId: 'wt-1'
  })
  subscribeToStripResize = navigation.subscribeToStripResize
  return (
    <div
      data-strip=""
      ref={navigation.tabStripRef}
    >
      {tabs.map((id) => (
        <div
          key={id}
          data-tab-id={id}
          onPointerDown={(event) => activation.onPointerDown(event)}
          data-tab-strip-slot={id}
        />
      ))}
      {hostedRows.map((id) => (
        <div
          key={id}
          data-tab-strip-slot={id}
        />
      ))}
    </div>
  )
}

const TABS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']

function mountScrolled(active: string, scrollLeft: number, hostedRows?: string[]) {
  const view = render(<Strip tabs={TABS} active={active} hostedRows={hostedRows} />)
  const strip = view.container.querySelector<HTMLElement>('[data-strip]')!
  act(() => {
    strip.scrollLeft = scrollLeft
    strip.dispatchEvent(new Event('scroll'))
  })
  return { ...view, strip }
}

function tabX(strip: HTMLElement, id: string): number {
  return strip.querySelector<HTMLElement>(`[data-tab-strip-slot="${id}"]`)!.getBoundingClientRect()
    .left
}

describe('tab strip scroll when tabs are added', () => {
  beforeEach(installStripLayout)
  afterEach(() => {
    cleanup()
    restoreStripLayout()
  })

  it('keeps the viewed tab still when a background tab lands on screen after it', () => {
    const { strip, rerender } = mountScrolled('F', 400)
    rerender(<Strip tabs={[...TABS.slice(0, 6), 'N', ...TABS.slice(6)]} active="F" />)
    expect(strip.scrollLeft).toBe(400)
    expect(tabX(strip, 'F')).toBe(100)
  })

  it('does not scroll for a background tab that opens on screen', () => {
    const { strip, rerender } = mountScrolled('B', 0)
    rerender(<Strip tabs={['A', 'B', 'N', ...TABS.slice(2)]} active="B" />)
    expect(strip.scrollLeft).toBe(0)
    expect(tabX(strip, 'B')).toBe(100)
  })

  it('scrolls to the end for a foreground tab appended at the end', () => {
    const { strip, rerender } = mountScrolled('C', 0)
    rerender(<Strip tabs={[...TABS, 'N']} active="N" />)
    expect(strip.scrollLeft).toBe(800)
  })

  it('reveals a background tab appended past the end, beside the active tab', () => {
    const { strip, rerender } = mountScrolled('J', 700)
    rerender(<Strip tabs={[...TABS, 'N']} active="J" />)
    expect(tabX(strip, 'J')).toBe(100)
    expect(tabX(strip, 'N')).toBe(200)
  })

  it('reveals a client-hosted row appended past the end', () => {
    const { strip, rerender } = mountScrolled('E', 300)
    rerender(<Strip tabs={TABS} hostedRows={['remote']} active="E" />)
    expect(strip.scrollLeft).toBe(800)
    expect(tabX(strip, 'remote')).toBe(200)
    expect(tabX(strip, 'E')).toBe(-400)
  })

  it('reveals a tab that replaces another even when the strip count stays the same', () => {
    const { strip, rerender } = mountScrolled('B', 0)
    rerender(<Strip tabs={['A', 'B', ...TABS.slice(3), 'N']} active="B" />)
    expect(strip.scrollLeft).toBe(700)
    expect(tabX(strip, 'B')).toBe(-600)
    expect(tabX(strip, 'N')).toBe(200)
  })

  it('does not scroll for a background tab while the pointer is over the strip', () => {
    const { strip, rerender } = mountScrolled('J', 700)
    const matches = Element.prototype.matches.bind(strip)
    Object.defineProperty(strip, 'matches', {
      value: (selector: string) => selector === ':hover' || matches(selector)
    })
    rerender(<Strip tabs={[...TABS, 'N']} active="J" />)
    expect(strip.scrollLeft).toBe(700)
    expect(tabX(strip, 'J')).toBe(200)
  })

  it('reveals a background tab that opened under the pointer once the pointer leaves', () => {
    const { strip, rerender } = mountScrolled('J', 700)
    const matches = Element.prototype.matches.bind(strip)
    Object.defineProperty(strip, 'matches', {
      value: (selector: string) => selector === ':hover' || matches(selector)
    })
    rerender(<Strip tabs={[...TABS, 'N']} active="J" />)
    act(() => {
      strip.dispatchEvent(new Event('pointerleave'))
    })
    expect(tabX(strip, 'J')).toBe(100)
    expect(tabX(strip, 'N')).toBe(200)
  })

  it('reveals deferred overflow after contextmenu retires the interrupted strip gesture', () => {
    const { strip, rerender } = mountScrolled('J', 700)
    const matches = Element.prototype.matches.bind(strip)
    Object.defineProperty(strip, 'matches', {
      value: (selector: string) => selector === ':hover' || matches(selector)
    })
    const tab = strip.querySelector<HTMLElement>('[data-tab-id="J"]')!
    fireEvent.pointerDown(tab, { button: 0, ctrlKey: true, clientX: 250, clientY: 10 })
    expect(isTabStripPointerGestureActive()).toBe(true)
    fireEvent.contextMenu(tab, { button: 0, ctrlKey: true })
    expect(isTabStripPointerGestureActive()).toBe(false)
    rerender(<Strip tabs={[...TABS, 'N']} active="J" />)
    expect(tabX(strip, 'J')).toBe(200)
    fireEvent.pointerLeave(strip)
    expect(tabX(strip, 'J')).toBe(100)
    expect(tabX(strip, 'N')).toBe(200)
  })

  it('reveals a distant background tab while the active tab scrolls offscreen', () => {
    const { strip, rerender } = mountScrolled('B', 0)
    rerender(<Strip tabs={[...TABS, 'N']} active="B" />)
    expect(tabX(strip, 'N')).toBe(200)
    expect(tabX(strip, 'B')).toBe(-700)
  })

  it('reveals a background tab to the left without docking the active tab', () => {
    const { strip, rerender } = mountScrolled('F', 400)
    rerender(<Strip tabs={['A', 'B', 'N', ...TABS.slice(2)]} active="F" />)
    expect(tabX(strip, 'N')).toBe(0)
    expect(tabX(strip, 'F')).toBe(400)
  })
})

describe('tab strip scroll when tabs are closed', () => {
  beforeEach(installStripLayout)
  afterEach(() => {
    cleanup()
    restoreStripLayout()
  })

  // RA: A replacement active tab must be revealed after closing the previous selection.
  it('reveals the active tab selected by closing a distant tab', () => {
    const { strip, rerender } = mountScrolled('E', 300)
    rerender(<Strip tabs={TABS.filter((id) => id !== 'E')} active="A" />)
    expect(strip.scrollLeft).toBe(0)
    expect(tabX(strip, 'A')).toBe(0)
  })

  it('still reveals a later tab switch after a close', () => {
    const { strip, rerender } = mountScrolled('E', 300)
    const remaining = TABS.filter((id) => id !== 'E')
    rerender(<Strip tabs={remaining} active="A" />)
    rerender(<Strip tabs={remaining} active="J" />)
    expect(strip.scrollLeft).toBe(600)
    expect(tabX(strip, 'I')).toBe(100)
  })
})

describe('tab strip selection without docking', () => {
  beforeEach(installStripLayout)
  afterEach(() => {
    cleanup()
    restoreStripLayout()
  })

  it('lets the active tab scroll offscreen until selection changes', () => {
    const { strip, rerender } = mountScrolled('H', 0)
    expect(tabX(strip, 'H')).toBe(700)
    rerender(<Strip tabs={TABS} active="I" />)
    expect(tabX(strip, 'I')).toBe(200)
    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenLastCalledWith({
      block: 'nearest',
      inline: 'nearest'
    })
  })

  it('reveals a client-hosted row when it takes the active state and restores the tab', () => {
    const { strip, rerender } = mountScrolled('E', 300, ['remote'])
    rerender(<Strip tabs={TABS} hostedRows={['remote']} activeHostedRow="remote" active="E" />)
    expect(strip.scrollLeft).toBe(800)
    expect(tabX(strip, 'remote')).toBe(200)
    rerender(<Strip tabs={TABS} hostedRows={['remote']} active="E" />)
    expect(strip.scrollLeft).toBe(400)
  })

  it('reveals a foreground tab opened next to an offscreen active tab', () => {
    const { strip, rerender } = mountScrolled('H', 0)
    rerender(<Strip tabs={[...TABS.slice(0, 8), 'N', ...TABS.slice(8)]} active="N" />)
    expect(tabX(strip, 'N')).toBe(200)
    expect(tabX(strip, 'H')).toBe(100)
  })

  it('reveals a background tab without reserving space for the offscreen active tab', () => {
    const { strip, rerender } = mountScrolled('B', 500)
    rerender(<Strip tabs={['A', 'B', 'N', ...TABS.slice(2)]} active="B" />)
    expect(tabX(strip, 'B')).toBe(-100)
    expect(tabX(strip, 'N')).toBe(0)
  })

  it('reveals a background tab at its nearest edge without an active dock', () => {
    const { strip, rerender } = mountScrolled('A', 700)
    rerender(<Strip tabs={[...TABS.slice(0, 5), 'N', ...TABS.slice(5)]} active="A" />)
    expect(tabX(strip, 'A')).toBe(-500)
    expect(tabX(strip, 'N')).toBe(0)
  })
})

describe('tab strip while scrolling', () => {
  beforeEach(installStripLayout)
  afterEach(() => {
    cleanup()
    restoreStripLayout()
  })

  it('does not re-render the strip for a scroll that stays between the edges', () => {
    const { strip } = mountScrolled('E', 300)
    const rendersBefore = stripRenderCount
    act(() => {
      strip.scrollLeft = 400
      strip.dispatchEvent(new Event('scroll'))
    })
    expect(stripRenderCount).toBe(rendersBefore)
  })

  it('reveals the active tab when a split becomes narrower', () => {
    const { strip } = mountScrolled('G', 400)
    act(() => {
      viewportWidth = 200
      notifyResize()
    })
    expect(strip.scrollLeft).toBe(500)
    expect(tabX(strip, 'G')).toBe(100)
  })

  it('tells resize subscribers when tabs change the strip without a scroll', async () => {
    const { rerender } = mountScrolled('J', 700)
    const listener = vi.fn()
    subscribeToStripResize!(listener)
    rerender(<Strip tabs={[...TABS, 'N']} active="J" />)
    await Promise.resolve()
    expect(listener).toHaveBeenCalled()
  })
})
