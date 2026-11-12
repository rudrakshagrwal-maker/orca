import { cn } from '@/lib/class-names'
import {
  SUBAGENT_TAB_CONTAINER_WIDTH_CLASSES,
  TAB_CONTAINER_WIDTH_CLASSES
} from './tab-width-rules'

type TabStripSlotProps = {
  className: string
  'data-tab-strip-slot': string
}

// RA: Selection scrolls normally; only explicit pinning changes a slot's width.
export function useTabStripSlotProps(
  tabId: string,
  isPinned = false,
  isSubagent = false
): TabStripSlotProps {
  return {
    className: cn(
      isPinned
        ? 'w-10 min-w-10 max-w-10 flex-none'
        : isSubagent
          ? SUBAGENT_TAB_CONTAINER_WIDTH_CLASSES
          : TAB_CONTAINER_WIDTH_CLASSES
    ),
    'data-tab-strip-slot': tabId
  }
}
