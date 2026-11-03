import { useLayoutEffect, useRef, useState } from 'react'
import { useAppStore } from '@/store'

export const SIDEBAR_AGENTS_MIN_HEIGHT = 90 // RA: six-pixel handle, header and two rows.

// RA: share the sidebar's available height, reserving the Projects header and one row.
export function useSidebarAgentSectionResize() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ y: number; height: number } | null>(null)
  const [maxHeight, setMaxHeight] = useState(360)
  const height = useAppStore((s) => s.sidebarAgentsHeight)
  const setHeight = useAppStore((s) => s.setSidebarAgentsHeight)
  const clamp = (value: number): number =>
    Math.min(maxHeight, Math.max(SIDEBAR_AGENTS_MIN_HEIGHT, value))
  useLayoutEffect(() => {
    const section = sectionRef.current
    const parent = section?.parentElement
    if (!section || !parent) {
      return
    }
    const measure = (): void => {
      const fixed = [...parent.children]
        .filter((node) => node !== section && getComputedStyle(node).flexShrink === '0')
        .reduce((sum, node) => sum + node.getBoundingClientRect().height, 0)
      setMaxHeight(Math.max(SIDEBAR_AGENTS_MIN_HEIGHT, parent.clientHeight - fixed - 56))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(parent)
    return () => observer.disconnect()
  }, [])
  return {
    sectionRef,
    maxHeight,
    height: height === null ? undefined : clamp(height),
    handleProps: {
      onPointerDown(event: React.PointerEvent<HTMLDivElement>): void {
        if (event.button !== 0) {
          return
        }
        event.preventDefault()
        drag.current = { y: event.clientY, height: sectionRef.current?.offsetHeight ?? 180 }
        event.currentTarget.setPointerCapture(event.pointerId)
      },
      onPointerMove(event: React.PointerEvent<HTMLDivElement>): void {
        if (drag.current) {
          setHeight(clamp(drag.current.height + drag.current.y - event.clientY))
        }
      },
      onPointerUp(event: React.PointerEvent<HTMLDivElement>): void {
        drag.current = null
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId)
        }
      },
      onLostPointerCapture(): void {
        drag.current = null
      },
      onPointerCancel(): void {
        drag.current = null
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
