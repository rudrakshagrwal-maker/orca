/** Strip slots exclude adjacent out-of-flow menu triggers. */
const SLOT_SELECTOR = '[data-tab-strip-slot]'

function getSlots(strip: HTMLElement): HTMLElement[] {
  return Array.from(strip.querySelectorAll<HTMLElement>(`:scope > ${SLOT_SELECTOR}`))
}

function getSlotId(slot: HTMLElement): string {
  return slot.dataset.tabStripSlot ?? ''
}

export function findTabStripSlot(strip: HTMLElement, tabId: string): HTMLElement | undefined {
  return getSlots(strip).find((slot) => getSlotId(slot) === tabId)
}

export function readTabStripSlotIds(strip: HTMLElement): ReadonlySet<string> {
  return new Set(getSlots(strip).map(getSlotId))
}

/** Which edge `slot`'s place in the tab order is past; null when that place is on screen. */
function getSlotOffscreenSide(strip: HTMLElement, slot: HTMLElement): 'start' | 'end' | null {
  const viewLeft = strip.getBoundingClientRect().left + strip.clientLeft
  const { left, right } = slot.getBoundingClientRect()
  if (left < viewLeft - 1) {
    return 'start'
  }
  if (right > viewLeft + strip.clientWidth + 1) {
    return 'end'
  }
  return null
}

/** The first slot missing from `knownIds` whose place in the tab order is off screen. */
export function findOffscreenOpenedTabStripSlot(
  strip: HTMLElement,
  knownIds: ReadonlySet<string>
): HTMLElement | undefined {
  return getSlots(strip).find(
    (slot) => !knownIds.has(getSlotId(slot)) && getSlotOffscreenSide(strip, slot) !== null
  )
}

// RA: Active tabs keep their natural position and scroll to the nearest visible edge.
export function revealTabStripSlot(slot: HTMLElement): void {
  slot.scrollIntoView({ block: 'nearest', inline: 'nearest' })
}
