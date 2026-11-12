import type {
  AiVaultSessionTitle,
  AiVaultSessionTitleRequest,
  AiVaultSessionTitlesResult
} from '../../../shared/ai-vault/contracts/ai-vault-session-title'
import { readTranscriptSlice, wslGatedStat } from '../../native-chat/wsl-transcript-fs-access'
import { readCodexSessionIndexTitle } from '../scanners/codex/session-scanner-codex-title-index'
import { normalizeTitleText } from '../session-scanner-text-normalization'

// RA: status naming reads only recent name records, never the cut history scanner or message cache.
const TITLE_READ_BYTES = 2 * 1024 * 1024

export async function readStatusSessionTitles(
  requests: AiVaultSessionTitleRequest[],
  signal?: AbortSignal
): Promise<AiVaultSessionTitlesResult> {
  const titles: AiVaultSessionTitle[] = []
  for (const request of requests) {
    if (signal?.aborted) {
      break
    }
    const path = request.transcriptPath
    if (!path) {
      continue
    }
    try {
      let title: string | null = null
      if (request.agent === 'codex') {
        title = await readCodexSessionIndexTitle(path, null, request.sessionId)
      } else {
        const stats = await wslGatedStat(path, 'scan', signal)
        if (!stats.isFile()) {
          continue
        }
        const start = Math.max(0, stats.size - TITLE_READ_BYTES)
        const bytes = await readTranscriptSlice(
          path,
          start,
          Math.min(stats.size, TITLE_READ_BYTES),
          'scan',
          signal
        )
        const lines = bytes.toString('utf8').split('\n')
        if (start > 0) {
          lines.shift()
        }
        let generated: string | null = null
        for (const line of lines.toReversed()) {
          if (!line.includes('"custom-title"') && !line.includes('"ai-title"')) {
            continue
          }
          try {
            const row = JSON.parse(line) as Record<string, unknown>
            if (typeof row.sessionId === 'string' && row.sessionId !== request.sessionId) {
              continue
            }
            if (
              row.type === 'custom-title' &&
              typeof row.customTitle === 'string' &&
              row.customTitle.trim()
            ) {
              title = row.customTitle
              break
            }
            if (!generated && row.type === 'ai-title' && typeof row.aiTitle === 'string') {
              generated = row.aiTitle
            }
          } catch {
            /* A partial append cannot supply a name. */
          }
        }
        title ??= generated
      }
      // RA: normalization can reject a nonempty transcript title.
      const normalizedTitle = title === null ? null : normalizeTitleText(title)
      if (normalizedTitle && !signal?.aborted) {
        titles.push({
          agent: request.agent,
          sessionId: request.sessionId,
          title: normalizedTitle,
          kind: 'named'
        })
      }
    } catch {
      /* Live OSC and the prior session name remain available after a read failure. */
    }
  }
  return { titles }
}
