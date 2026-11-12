// RA: Node20 dynamic imports require the emitted .js extension.
import { extname } from 'node:path'
import { hasUnsafeProviderSessionIdChars } from '../../../shared/agent-session/lifecycle/agent-session-resume'
import {
  AI_VAULT_SESSION_TITLE_REQUEST_MAX_COUNT,
  type AiVaultSessionTitleRequest,
  type AiVaultSessionTitlesResult
} from '../../../shared/ai-vault/contracts/ai-vault-session-title'
import { resolveAiVaultSessionTitlesInBackground } from '../scan-service/session-scanner-background'
import { backgroundJobsDisabled } from '../../../shared/fork-background-policy'

const TRANSCRIPT_PATH_MAX_LENGTH = 32_768

function normalizeRequest(request: AiVaultSessionTitleRequest): AiVaultSessionTitleRequest | null {
  const sessionId = request.sessionId.trim()
  if (!sessionId || sessionId.length > 512 || hasUnsafeProviderSessionIdChars(sessionId)) {
    return null
  }
  const transcriptPath = request.transcriptPath?.trim()
  if (
    !transcriptPath ||
    transcriptPath.length > TRANSCRIPT_PATH_MAX_LENGTH ||
    hasUnsafeProviderSessionIdChars(transcriptPath) ||
    extname(transcriptPath).toLowerCase() !== '.jsonl'
  ) {
    return { agent: request.agent, sessionId }
  }
  return { agent: request.agent, sessionId, transcriptPath }
}

export async function resolveLocalAiVaultSessionTitles(
  requests: AiVaultSessionTitleRequest[],
  signal?: AbortSignal
): Promise<AiVaultSessionTitlesResult> {
  const deduped = new Map<string, AiVaultSessionTitleRequest>()
  for (const request of requests.slice(0, AI_VAULT_SESSION_TITLE_REQUEST_MAX_COUNT)) {
    const normalized = normalizeRequest(request)
    if (!normalized) {
      continue
    }
    const key = `${normalized.agent}\0${normalized.sessionId}`
    const previous = deduped.get(key)
    if (!previous?.transcriptPath || normalized.transcriptPath) {
      deduped.set(key, normalized)
    }
  }
  if (backgroundJobsDisabled()) {
    // RA: status events may read their exact Claude/Codex transcript without restarting the cut scanner service.
    const requests = [...deduped.values()].filter(
      (request) =>
        (request.agent === 'claude' || request.agent === 'codex') && request.transcriptPath
    )
    if (!requests.length) {
      return { titles: [] }
    }
    const { readStatusSessionTitles } = await import('./status-session-title-reader.js')
    const { resolveHostReadableAiVaultTitleRequests } =
      await import('./session-title-request-paths.js')
    return readStatusSessionTitles(
      await resolveHostReadableAiVaultTitleRequests(requests, signal),
      signal
    )
  }
  return resolveAiVaultSessionTitlesInBackground([...deduped.values()], signal)
}
