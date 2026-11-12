import type { RuntimePtyWorktreeRecord } from '../records/runtime-terminal-state-records'
import type { AgentStatusIpcPayload } from '../../../../shared/agent-status/contracts/agent-status-ipc-payload'
import type { ObservedAgentStatusPaneIdentity } from '../../../ipc/agent-status-ipc-boundary'

// RA: only the terminal's own observed session or admitted resume can carry its Run across restore.
export function terminalCoordinatorIdentity(
  handle: string,
  processIncarnation: string | null,
  pty: RuntimePtyWorktreeRecord | undefined,
  rows: readonly AgentStatusIpcPayload[],
  observed: (paneKey: string) => ObservedAgentStatusPaneIdentity
): { processIncarnation: string | null; agentSessionId: string | null } {
  if (!pty) {
    return { processIncarnation, agentSessionId: null }
  }
  const row = rows.find((entry) => {
    const identity = observed(entry.paneKey)
    return (
      identity.kind === 'observed' &&
      identity.terminalHandle === handle &&
      identity.processIncarnation === processIncarnation &&
      !entry.restoredUnconfirmed &&
      entry.providerSession
    )
  })
  if (row?.providerSession) {
    return { processIncarnation, agentSessionId: `${row.agentType}:${row.providerSession.id}` }
  }
  const saved = pty.savedTerminalLaunchResult
  const resumed =
    saved?.incarnationId === pty.incarnationId ? saved?.result.resumeProviderSession : undefined
  return { processIncarnation, agentSessionId: resumed ? `${pty.launchAgent}:${resumed.id}` : null }
}
