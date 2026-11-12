import { useAppStore } from '@/store'
import type { AgentStatusIpcPayload } from '../../../../shared/agent-status/contracts/agent-status-ipc-payload'
import { collectAiVaultTitleRequests } from '@/lib/agent-session/history/title-sync/ai-vault-tab-title-requests'

const inFlight = new Set<string>()

// RA: title refresh follows accepted hook events, without the disabled title poller or scanner process.
export function refreshStatusSessionTitle(data: AgentStatusIpcPayload): void {
  if (
    data.observation?.origin !== 'hook' ||
    !data.providerSession ||
    (data.agentType !== 'claude' && data.agentType !== 'codex')
  ) {
    return
  }
  queueMicrotask(() => {
    const request = collectAiVaultTitleRequests(useAppStore.getState()).find(
      (item) =>
        item.paneKey === data.paneKey && item.providerSession.id === data.providerSession?.id
    )
    if (!request || !request.providerSession.transcriptPath) {
      return
    }
    const key = `${request.executionHostId}\0${request.tabId}\0${request.providerSession.id}`
    if (inFlight.has(key)) {
      return
    }
    inFlight.add(key)
    void window.api.aiVault
      .resolveSessionTitles({
        executionHostScope: request.executionHostId,
        requests: [
          {
            agent: request.agent,
            sessionId: request.providerSession.id,
            transcriptPath: request.providerSession.transcriptPath
          }
        ]
      })
      .then((result) => {
        const current = collectAiVaultTitleRequests(useAppStore.getState()).find(
          (item) =>
            item.tabId === request.tabId &&
            item.paneKey === request.paneKey &&
            item.executionHostId === request.executionHostId &&
            item.providerSession.id === request.providerSession.id
        )
        const title = result.titles.find(
          (item) => item.agent === request.agent && item.sessionId === request.providerSession.id
        )
        if (current && title?.title.trim()) {
          useAppStore.getState().setAiVaultTabTitle(request.tabId, title)
        }
      })
      .catch(() => {})
      .finally(() => inFlight.delete(key))
  })
}
