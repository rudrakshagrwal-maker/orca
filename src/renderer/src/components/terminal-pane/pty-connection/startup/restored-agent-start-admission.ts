// RA: both reconnect and fallback cold-spawn paths use one queue and recheck ownership after waiting.
import { restoredAgentStarts } from '../../../../../../shared/terminal/restore-agent-start-queue'
import { useAppStore } from '@/store/index'
import type { ConnectPanePtySession } from '../connect-pane-pty-session'

export function admitRestoredAgentStart<T>(
  session: ConnectPanePtySession,
  agent: string | undefined,
  start: () => Promise<T>,
  current: () => boolean = () => true
): Promise<T | null> {
  // RA: already-cancelled resume records consume no launch slot.
  if (!current()) {
    return Promise.resolve(null)
  }
  const generation = session.transportStreamGeneration
  return restoredAgentStarts.run(
    agent,
    () => useAppStore.getState().activeTabId === session.deps.tabId,
    async () => {
      if (session.disposed || generation !== session.transportStreamGeneration || !current()) {
        return null
      }
      return start()
    }
  )
}
