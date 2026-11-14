import type { RuntimeClient } from './runtime-client'
import { RuntimeClientError } from './runtime-client'
import type { AgentSessionHistoryResult } from '../shared/agent-session/agent-session-wire'
import type { AgentJournalRenderItem } from '../shared/agent-session/journal/agent-session-journal-types'
import { agentJournalSubmissionKey } from '../shared/agent-session/journal/agent-session-journal-item-key'
import { readAgentJournalTurn } from '../shared/agent-session/lifecycle/agent-session-turn-record'
import { chatTranscript } from './chat-sessions'
import { readHistory, type ChatSettled } from './chat-history'

// A second caller may have sent another message before the first caller reads its reply.
export async function readBotReply(
  client: RuntimeClient,
  session: string,
  clientMessageId: string,
  settled: ChatSettled
) {
  let history = (await readHistory(client, session, 200)).result
  const nativeSessionId = history.providerSession?.id ?? null
  const epoch = history.page.epoch
  const items = new Map<string, AgentJournalRenderItem>()
  const userId = agentJournalSubmissionKey(clientMessageId)
  let turnItem: AgentJournalRenderItem | undefined
  let pages = 0
  for (;;) {
    for (const item of history.page.items) {
      items.set(item.itemId, item)
    }
    turnItem = [...items.values()].find(
      (item) => readAgentJournalTurn(item.body)?.userItemId === userId
    )
    if (turnItem || !history.page.hasOlder || !history.page.window.oldest || ++pages >= 50) {
      break
    }
    history = (
      await client.call<AgentSessionHistoryResult>('agentSession.history', {
        sessionId: session,
        direction: 'before',
        cursor: history.page.window.oldest,
        limit: 200
      })
    ).result
    if (history.page.epoch !== epoch) {
      throw new RuntimeClientError(
        'bot_reply_unavailable',
        'The chat history changed while reading the reply. Read its chat in Orca.'
      )
    }
  }
  if (!turnItem) {
    if (settled === 'done') {
      throw new RuntimeClientError(
        'bot_reply_unavailable',
        'Could not identify this message’s reply. Read its chat in Orca.'
      )
    }
    return {
      entries: [],
      nativeSessionId,
      truncated: history.page.hasOlder,
      turnOutcome: undefined
    }
  }
  const turnId = turnItem.itemId
  const ownItems = [...items.values()]
    .filter(
      (item) =>
        item.itemId === turnId ||
        (item.turnScope?.kind === 'turn' && item.turnScope.turnItemId === turnId)
    )
    .sort((a, b) => a.sequence - b.sequence || (a.sequenceIndex ?? 0) - (b.sequenceIndex ?? 0))
  return {
    entries: chatTranscript(ownItems, history.page.actionablePromptIds),
    nativeSessionId,
    truncated: ownItems.some((item) => item.shortened === true),
    turnOutcome: readAgentJournalTurn(turnItem.body)?.outcome
  }
}
