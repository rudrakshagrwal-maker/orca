import { describe, expect, it } from 'vitest'
import {
  computeTabStripOverflowState,
  computeTabStripThumbLayout,
  getTabStripScrollMaskClassName
} from './tab-strip-scroll-metrics'

describe('computeTabStripOverflowState', () => {
  it('reports no overflow when all tabs fit', () => {
    expect(
      computeTabStripOverflowState({
        scrollWidth: 400,
        clientWidth: 400,
        scrollLeft: 0
      })
    ).toEqual({
      hasOverflow: false,
      canScrollStart: false,
      canScrollEnd: false
    })
  })

  it('marks the start and end scroll edges', () => {
    expect(
      computeTabStripOverflowState({
        scrollWidth: 800,
        clientWidth: 400,
        scrollLeft: 0
      }).canScrollStart
    ).toBe(false)
    expect(
      computeTabStripOverflowState({
        scrollWidth: 800,
        clientWidth: 400,
        scrollLeft: 0
      }).canScrollEnd
    ).toBe(true)

    expect(
      computeTabStripOverflowState({
        scrollWidth: 800,
        clientWidth: 400,
        scrollLeft: 400
      }).canScrollStart
    ).toBe(true)
    expect(
      computeTabStripOverflowState({
        scrollWidth: 800,
        clientWidth: 400,
        scrollLeft: 400
      }).canScrollEnd
    ).toBe(false)
  })
})

describe('computeTabStripThumbLayout', () => {
  it('clamps thumb width and keeps the thumb inside the track', () => {
    expect(
      computeTabStripThumbLayout(200, { scrollWidth: 10_000, clientWidth: 400, scrollLeft: 9_600 })
    ).toEqual({
      widthPx: 18,
      leftPx: 182
    })
  })

  it('sizes and offsets the thumb from the strip scroll position', () => {
    expect(
      computeTabStripThumbLayout(400, { scrollWidth: 800, clientWidth: 400, scrollLeft: 100 })
    ).toEqual({
      widthPx: 200,
      leftPx: 50
    })
  })
})

describe('getTabStripScrollMaskClassName', () => {
  it('returns no classes when the strip does not overflow', () => {
    expect(
      getTabStripScrollMaskClassName({
        hasOverflow: false,
        canScrollStart: false,
        canScrollEnd: false
      })
    ).toBe('')
  })

  it('returns both fade classes when more tabs exist on both sides', () => {
    expect(
      getTabStripScrollMaskClassName({
        hasOverflow: true,
        canScrollStart: true,
        canScrollEnd: true
      })
    ).toBe('terminal-tab-strip--fade-start terminal-tab-strip--fade-end')
  })

  // RA: Fade edges follow scroll position with no active-tab exemption.
  it('fades only the edge with offscreen tabs', () => {
    expect(
      getTabStripScrollMaskClassName({
        hasOverflow: true,
        canScrollStart: false,
        canScrollEnd: true
      })
    ).toBe('terminal-tab-strip--fade-end')
    expect(
      getTabStripScrollMaskClassName({
        hasOverflow: true,
        canScrollStart: true,
        canScrollEnd: false
      })
    ).toBe('terminal-tab-strip--fade-start')
  })
})
