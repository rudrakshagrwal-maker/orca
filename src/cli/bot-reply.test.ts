import { describe, expect, it } from 'vitest'
import { readBotReply } from './bot-reply'
import type { RuntimeClient } from './runtime-client'
import type { AgentJournalRenderItem } from '../shared/agent-session/journal/agent-session-journal-types'

function clientFor(pages: AgentJournalRenderItem[][]) {
  let index = 0
  const transport = {
    call: async () => ({
      result: {
        ok: true,
        providerSession: { id: 'native-hermes' },
        page: {
          epoch: 'epoch-1',
          items: pages[index++],
          hasOlder: index < pages.length,
          window: { oldest: { epoch: 'epoch-1', sequence: 1 } }
        }
      }
    })
  }
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: The reader uses only the public history call transport supplied by this fixture.
  return transport as unknown as RuntimeClient
}
const firstTurn: AgentJournalRenderItem = {
  itemId: 'turn-first',
  revision: 1,
  sequence: 1,
  observedAt: 1,
  body: {
    kind: 'turn',
    turnId: 'first',
    userItemId: 'orca:message-first',
    state: 'completed',
    outcome: 'success'
  }
}
const firstReply: AgentJournalRenderItem = {
  itemId: 'reply-first',
  revision: 1,
  sequence: 2,
  observedAt: 2,
  turnScope: { kind: 'turn', turnItemId: 'turn-first' },
  body: {
    kind: 'message',
    role: 'assistant',
    blocks: [{ type: 'text', text: 'First caller answer' }]
  }
}
const laterReply: AgentJournalRenderItem = {
  itemId: 'reply-later',
  revision: 1,
  sequence: 3,
  observedAt: 3,
  turnScope: { kind: 'turn', turnItemId: 'turn-later' },
  body: {
    kind: 'message',
    role: 'assistant',
    blocks: [{ type: 'text', text: 'Another caller answer' }]
  }
}

describe('bot reply attribution', () => {
  it('returns this ask’s reply even when another caller sent a later message', async () => {
    const result = await readBotReply(
      clientFor([[firstTurn, firstReply, laterReply]]),
      'bot-session',
      'message-first',
      'done'
    )
    expect(result.entries).toEqual([
      { kind: 'message', role: 'assistant', text: 'First caller answer' }
    ])
    expect(result.nativeSessionId).toBe('native-hermes')
  })
  it('reads back past a later caller’s history page to find the requested turn', async () => {
    const result = await readBotReply(
      clientFor([[laterReply], [firstTurn, firstReply]]),
      'bot-session',
      'message-first',
      'done'
    )
    expect(result.entries).toEqual([
      { kind: 'message', role: 'assistant', text: 'First caller answer' }
    ])
  })
  it('refuses to return an unrelated reply when the requested turn cannot be found', async () => {
    await expect(
      readBotReply(clientFor([[laterReply]]), 'bot-session', 'missing-message', 'done')
    ).rejects.toThrow('Could not identify')
  })
})
