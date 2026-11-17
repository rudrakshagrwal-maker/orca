import type { AiVaultSession } from '../../shared/ai-vault/contracts/ai-vault-types'

import { parseClaudeSessionFile } from './scanners/claude/session-scanner-primary-parsers'

import { parseCodexSessionFile } from './scanners/codex/session-scanner-codex-parser'

import type { SessionFileCandidate } from './session-scanner-types'
import type { TranscriptMessageSink } from './transcripts/session-transcript-consumers'
import type { SkippedTranscriptRecord } from './transcripts/session-transcript-record-budget'

/** Listing needs only a preview; active message sinks require the full transcript. */

export async function parseAgentSessionFile(
  candidate: SessionFileCandidate,
  platform: NodeJS.Platform,
  messages?: TranscriptMessageSink,
  _signal?: AbortSignal,
  _onSkippedRecords?: (records: SkippedTranscriptRecord[]) => void
): Promise<AiVaultSession | null> {
  // RA: legacy candidates have no parser in this fork.
  switch (candidate.agent) {
    case 'claude':
      return parseClaudeSessionFile(candidate.file, platform, messages)
    case 'codex':
      return parseCodexSessionFile(
        candidate.file,
        platform,
        candidate.codexHome,
        undefined,
        messages
      )

    default:
      return null
  }
}
