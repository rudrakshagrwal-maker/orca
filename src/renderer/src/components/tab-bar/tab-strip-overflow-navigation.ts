import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { bindTabStripContentResizeObservers } from './tab-strip-content-resize-observers'
import {
  computeTabStripOverflowState,
  sameTabStripOverflowState,
  type TabStripOverflowState
} from './tab-strip-scroll-metrics'
import { isTabStripPointerGestureActive } from './tab-strip-pointer-gesture'
import {
  captureTabStripScrollAnchor,
  isLastTabStripTab,
  restoreTabStripScrollAnchor,
  type TabStripScrollAnchor
} from './tab-strip-scroll-anchor'
import {
  findOffscreenOpenedTabStripSlot,
  findTabStripSlot,
  readTabStripSlotIds,
  revealTabStripSlot
} from './tab-strip-slot-geometry'
import { motionSafeScrollBehavior } from '@/hooks/usePrefersReducedMotion'
import { useTabDragActive } from '../tab-group/tab-drag-context'

const TAB_STRIP_SCROLL_FRACTION = 0.75
const TAB_STRIP_MIN_SCROLL_STEP_PX = 120

export function scrollTabStripByStep(
  el: HTMLElement,
  direction: 'start' | 'end',
  behavior: ScrollBehavior = 'smooth'
): void {
  const scrollStep = Math.max(
    TAB_STRIP_MIN_SCROLL_STEP_PX,
    el.clientWidth * TAB_STRIP_SCROLL_FRACTION
  )
  el.scrollBy({
    left: direction === 'start' ? -scrollStep : scrollStep,
    behavior: motionSafeScrollBehavior(behavior)
  })
}

function isTabStripScrolledToEnd(el: HTMLElement): boolean {
  const max = Math.max(0, el.scrollWidth - el.clientWidth)
  return el.scrollLeft >= max - 2
}

const EMPTY_TAB_STRIP_OVERFLOW_STATE: TabStripOverflowState = {
  hasOverflow: false,
  canScrollStart: false,
  canScrollEnd: false
}

export function useTabStripOverflowNavigation({
  activeVisibleTabId,
  activeSlotId,
  layoutKey,
  worktreeId
}: {
  activeVisibleTabId: string | null
  /** The slot drawn active; a client-hosted row can take it without `activeVisibleTabId` changing. */
  activeSlotId: string | null
  layoutKey: string
  worktreeId: string
}): {
  tabStripRef: RefObject<HTMLDivElement | null>
  tabStripOverflowState: TabStripOverflowState
  scrollTabStrip: (direction: 'start' | 'end', behavior?: ScrollBehavior) => void
  subscribeToStripResize: (listener: () => void) => () => void
} {
  const isTabDragActive = useTabDragActive()
  const tabStripRef = useRef<HTMLDivElement>(null)
  const stripResizeListenersRef = useRef<Set<() => void>>(new Set())
  const prevStripRef = useRef<{ worktreeId: string; tabIds: ReadonlySet<string> } | null>(null)
  const stickToEndRef = useRef(false)
  const activeTabIdRef = useRef<string | null>(null)
  const activeSlotIdRef = useRef<string | null>(null)
  const hoverDeferredRevealIdsRef = useRef<Set<string>>(new Set())
  const scrollAnchorRef = useRef<{
    activeTabId: string | null
    anchor: TabStripScrollAnchor | null
  } | null>(null)
  // Why no thumb position here: it changes every scroll frame, and every tab would re-render with it.
  const [tabStripOverflowState, setTabStripOverflowState] = useState<TabStripOverflowState>(
    EMPTY_TAB_STRIP_OVERFLOW_STATE
  )
  const updateTabStripOverflowState = useCallback((): void => {
    const el = tabStripRef.current
    if (!el) {
      return
    }
    const next = computeTabStripOverflowState(el)
    setTabStripOverflowState((previous) =>
      sameTabStripOverflowState(previous, next) ? previous : next
    )
  }, [])
  const scrollTabStrip = useCallback(
    (direction: 'start' | 'end', behavior: ScrollBehavior = 'smooth'): void => {
      const el = tabStripRef.current
      if (!el) {
        return
      }
      scrollTabStripByStep(el, direction, behavior)
    },
    []
  )
  const recordScrollAnchor = useCallback((): void => {
    const el = tabStripRef.current
    if (!el) {
      return
    }
    const activeTabId = activeTabIdRef.current
    scrollAnchorRef.current = { activeTabId, anchor: captureTabStripScrollAnchor(el, activeTabId) }
  }, [])

  useEffect(() => {
    const el = tabStripRef.current
    if (!el) {
      return
    }
    const onWheel = (e: WheelEvent): void => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault()
        el.scrollLeft += e.deltaY
        updateTabStripOverflowState()
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [updateTabStripOverflowState])

  useEffect(() => {
    const el = tabStripRef.current
    if (!el) {
      return
    }
    const onScroll = (): void => {
      // Only keep sticking while the user hasn't intentionally scrolled away.
      stickToEndRef.current = isTabStripScrolledToEnd(el)
      updateTabStripOverflowState()
      recordScrollAnchor()
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    onScroll()

    let previousClientWidth = el.clientWidth
    const handleStripResize = (): void => {
      const viewportChanged = previousClientWidth !== el.clientWidth
      previousClientWidth = el.clientWidth
      updateTabStripOverflowState()
      // Keep end-pinned strips at the right edge as live labels change scrollWidth.
      if (stickToEndRef.current && !isTabStripPointerGestureActive()) {
        el.scrollLeft = Math.max(0, el.scrollWidth - el.clientWidth)
      }
      // RA: A split resize can hide the active slot, including a client-hosted browser row.
      if (viewportChanged && !isTabStripPointerGestureActive()) {
        const activeSlot = activeSlotIdRef.current
          ? findTabStripSlot(el, activeSlotIdRef.current)
          : undefined
        if (activeSlot) {
          revealTabStripSlot(activeSlot)
          stickToEndRef.current = isTabStripScrolledToEnd(el)
        }
      }
      updateTabStripOverflowState()
      recordScrollAnchor()
      for (const listener of stripResizeListenersRef.current) {
        listener()
      }
    }

    const disconnectResizeObservers = bindTabStripContentResizeObservers(el, handleStripResize)

    return () => {
      el.removeEventListener('scroll', onScroll)
      disconnectResizeObservers()
    }
  }, [recordScrollAnchor, updateTabStripOverflowState])

  useEffect(() => {
    const el = tabStripRef.current
    if (!el) {
      return
    }
    const onPointerLeave = (): void => {
      const deferred = hoverDeferredRevealIdsRef.current
      if (deferred.size === 0) {
        return
      }
      hoverDeferredRevealIdsRef.current = new Set()
      if (isTabStripPointerGestureActive()) {
        return
      }
      const knownIds = new Set([...readTabStripSlotIds(el)].filter((id) => !deferred.has(id)))
      const offscreenOpened = findOffscreenOpenedTabStripSlot(el, knownIds)
      if (!offscreenOpened) {
        return
      }
      revealTabStripSlot(offscreenOpened)
      stickToEndRef.current = isTabStripScrolledToEnd(el)
      updateTabStripOverflowState()
      recordScrollAnchor()
    }
    el.addEventListener('pointerleave', onPointerLeave)
    return () => el.removeEventListener('pointerleave', onPointerLeave)
  }, [recordScrollAnchor, updateTabStripOverflowState])

  // Why a ref set first: the growth effect below must see this commit's active tab without re-running on every tab switch.
  useLayoutEffect(() => {
    activeTabIdRef.current = activeVisibleTabId
  }, [activeVisibleTabId])
  useLayoutEffect(() => {
    activeSlotIdRef.current = activeSlotId
  }, [activeSlotId])

  useLayoutEffect(() => {
    const strip = tabStripRef.current
    if (!strip) {
      prevStripRef.current = null
      return
    }
    const prev = prevStripRef.current
    const tabIds = readTabStripSlotIds(strip)
    prevStripRef.current = { worktreeId, tabIds }
    if (!prev || prev.worktreeId !== worktreeId) {
      hoverDeferredRevealIdsRef.current = new Set()
      updateTabStripOverflowState()
      return
    }
    const pointerGestureActive = isTabStripPointerGestureActive()
    // Why identities, not a count: a tab that replaces another opens without the strip growing.
    const tabOpened = [...tabIds].some((id) => !prev.tabIds.has(id))
    const scrollToEnd = (stick: boolean): void => {
      const el = tabStripRef.current
      if (!el) {
        return
      }
      el.scrollLeft = Math.max(0, el.scrollWidth - el.clientWidth)
      if (stick) {
        stickToEndRef.current = true
      }
      updateTabStripOverflowState()
    }
    const recorded = scrollAnchorRef.current
    if (tabOpened && !pointerGestureActive) {
      if (recorded?.activeTabId === activeTabIdRef.current) {
        // RA: Preserve the viewed tab through insertion, then reveal offscreen destinations normally.
        if (recorded.anchor) {
          restoreTabStripScrollAnchor(strip, recorded.anchor)
        }
        // Why wait for the pointer to leave: the tab it is over would slide away before the click lands.
        if (strip.matches(':hover')) {
          for (const id of tabIds) {
            if (!prev.tabIds.has(id)) {
              hoverDeferredRevealIdsRef.current.add(id)
            }
          }
        } else {
          const offscreenOpened = findOffscreenOpenedTabStripSlot(strip, prev.tabIds)
          if (offscreenOpened) {
            revealTabStripSlot(offscreenOpened)
          }
        }
        stickToEndRef.current = isTabStripScrolledToEnd(strip)
      } else if (isLastTabStripTab(strip, activeTabIdRef.current)) {
        scrollToEnd(true)
        requestAnimationFrame(() => scrollToEnd(true))
      }
      // A foreground tab opened mid-strip is revealed by the active-tab effect below.
    } else if (stickToEndRef.current && !pointerGestureActive) {
      scrollToEnd(false)
      // Why re-check: a reveal later in this commit may have scrolled away from the end.
      requestAnimationFrame(() => {
        if (stickToEndRef.current) {
          scrollToEnd(false)
        }
      })
    }
    updateTabStripOverflowState()
    requestAnimationFrame(updateTabStripOverflowState)
    recordScrollAnchor()
  }, [layoutKey, recordScrollAnchor, updateTabStripOverflowState, worktreeId])

  useLayoutEffect(() => {
    const strip = tabStripRef.current
    if (!strip || !activeSlotId) {
      recordScrollAnchor()
      return
    }
    const activeSlot = findTabStripSlot(strip, activeSlotId)
    if (!activeSlot) {
      recordScrollAnchor()
      return
    }
    // RA: Reveal selection after closes too; defer only while a pointer gesture or drag owns the strip.
    if (isTabStripPointerGestureActive() || isTabDragActive) {
      requestAnimationFrame(updateTabStripOverflowState)
      recordScrollAnchor()
      return
    }
    revealTabStripSlot(activeSlot)
    // Why: the scroll event lands after the resize observer, which would re-pin a stale end stick over this reveal.
    stickToEndRef.current = isTabStripScrolledToEnd(strip)
    requestAnimationFrame(updateTabStripOverflowState)
    recordScrollAnchor()
  }, [activeSlotId, isTabDragActive, recordScrollAnchor, updateTabStripOverflowState])

  // Why share these observers: each one watches every tab, so a second set doubles that work.
  const subscribeToStripResize = useCallback((listener: () => void): (() => void) => {
    stripResizeListenersRef.current.add(listener)
    return () => {
      stripResizeListenersRef.current.delete(listener)
    }
  }, [])

  return {
    tabStripRef,
    tabStripOverflowState,
    scrollTabStrip,
    subscribeToStripResize
  }
}
