import { useLayoutEffect, useRef, useState } from 'react'
import { useAppStore } from '@/store'

export const SIDEBAR_AGENTS_MIN_HEIGHT = 90 // RA: six-pixel handle, header and two rows.

export function useSidebarAgentSectionResize() {
  const height = useAppStore((s) => s.sidebarAgentsHeight)
  const setHeight = useAppStore((s) => s.setSidebarAgentsHeight)
  return useSidebarSectionResize({
    height,
    setHeight,
    minHeight: SIDEBAR_AGENTS_MIN_HEIGHT,
    reservedHeight: 56
  })
}

export function useSidebarSectionResize({
  height,
  setHeight,
  minHeight,
  reservedHeight,
  defaultFraction,
  enabled = true
}: {
  height: number | null
  setHeight: (height: number | null) => void
  minHeight: number
  reservedHeight: number
  defaultFraction?: number
  enabled?: boolean
}) {
  const sectionRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ pointerId: number; y: number; height: number } | null>(null)
  const [availableHeight, setAvailableHeight] = useState<number | null>(null)
  const [isResizing, setIsResizing] = useState(false)
  const minimumHeight = Math.min(minHeight, (availableHeight ?? Infinity) / 2)
  const maxHeight =
    availableHeight === null ? 360 : Math.max(minimumHeight, availableHeight - reservedHeight)
  const clamp = (value: number): number => Math.min(maxHeight, Math.max(minimumHeight, value))
  useLayoutEffect(() => {
    drag.current = null
    setIsResizing(false)
    const section = sectionRef.current
    const parent = section?.parentElement
    if (!enabled || !section || !parent) {
      return
    }
    const measure = (): void => {
      const fixed = [...parent.children]
        .filter((node) => node !== section && getComputedStyle(node).flexShrink === '0')
        .reduce((sum, node) => sum + node.getBoundingClientRect().height, 0)
      setAvailableHeight(Math.max(0, parent.clientHeight - fixed))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(parent)
    return () => observer.disconnect()
  }, [enabled])
  return {
    sectionRef,
    isResizing,
    minHeight: minimumHeight,
    maxHeight,
    height:
      height !== null
        ? clamp(height)
        : defaultFraction !== undefined && availableHeight !== null
          ? clamp(availableHeight * defaultFraction)
          : undefined,
    handleProps: {
      onPointerDown(event: React.PointerEvent<HTMLDivElement>): void {
        if (!enabled || event.button !== 0 || drag.current) {
          return
        }
        event.preventDefault()
        drag.current = {
          pointerId: event.pointerId,
          y: event.clientY,
          height: sectionRef.current?.offsetHeight ?? 180
        }
        setIsResizing(true)
        event.currentTarget.setPointerCapture(event.pointerId)
      },
      onPointerMove(event: React.PointerEvent<HTMLDivElement>): void {
        if (drag.current?.pointerId === event.pointerId) {
          setHeight(clamp(drag.current.height + drag.current.y - event.clientY))
        }
      },
      onPointerUp(event: React.PointerEvent<HTMLDivElement>): void {
        if (drag.current?.pointerId !== event.pointerId) {
          return
        }
        drag.current = null
        setIsResizing(false)
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId)
        }
      },
      onLostPointerCapture(): void {
        drag.current = null
        setIsResizing(false)
      },
      onPointerCancel(): void {
        drag.current = null
        setIsResizing(false)
      },
      onDoubleClick(): void {
        setHeight(null)
      },
      onKeyDown(event: React.KeyboardEvent<HTMLDivElement>): void {
        if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown' && event.key !== 'Home') {
          return
        }
        event.preventDefault()
        setHeight(
          event.key === 'Home'
            ? null
            : clamp(
                (sectionRef.current?.offsetHeight ?? 180) + (event.key === 'ArrowUp' ? 28 : -28)
              )
        )
      }
    }
  }
}
