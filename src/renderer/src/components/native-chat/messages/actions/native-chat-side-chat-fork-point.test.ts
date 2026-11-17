// @vitest-environment happy-dom
import {
  nativeChatRowOffersFork,
  nativeChatForkInventory
} from '../../../../../../shared/native-chat/native-chat-fork-offer'
import { describe, expect, it, vi } from 'vitest'

import type { NativeChatMessage } from '../../../../../../shared/native-chat/native-chat-types'
import type { NativeChatTranscriptSlotsInput } from '../../conversation/slots/native-chat-transcript-input'
import { buildNativeChatTranscript } from '../../conversation/slots/native-chat-transcript-slots'

const host = vi.hoisted(
  (): {
    capabilities: Set<string>
    contacts: Set<() => void>
  } => ({
    capabilities: new Set<string>(),
    contacts: new Set<() => void>()
  })
)
vi.mock('@/runtime/rpc/compatibility/runtime-capability-proof', () => ({
  runtimeEnvironmentSupportsCapability: (_environmentId: string, capability: string) =>
    Promise.resolve(host.capabilities.has(capability))
}))
vi.mock('@/runtime/hosts/connections/runtime-host-contact-regained', () => ({
  subscribeRuntimeHostContactRegained: (_environmentId: string, listener: () => void) => {
    host.contacts.add(listener)
    return () => host.contacts.delete(listener)
  }
}))
vi.mock('@/runtime/native-chat/agent-catalogs/use-host-structured-agent', () => ({
  useHostStructuredAgent: () => ({ capabilities: { fork: 'tip' } })
}))
vi.mock('@/components/native-chat/messages/actions/native-chat-fork-launch', () => ({
  launchNativeChatFork: vi.fn(),
  nativeChatForkSurfaceAddress: vi.fn()
}))
vi.mock('@/components/native-chat/messages/actions/native-chat-side-chat-placement', () => ({
  beginNativeChatSideChatPlacement: vi.fn()
}))

function row(id: string, role: 'user' | 'assistant', sequence: number): NativeChatMessage {
  return {
    id,
    role,
    blocks: [{ type: 'text', text: id }],
    timestamp: sequence,
    source: 'transcript',
    journalPosition: { sequence, index: 0 }
  }
}

/** `turns` finished turns, then a running one, laid out as the transcript draws them. */
function conversation(turns: { ask: string; replies: NativeChatMessage[] }[], working: boolean) {
  const messages = turns.flatMap((turn, index) => [
    row(turn.ask, 'user', index * 10_000),
    ...turn.replies
  ])
  const turnKeys = turns.flatMap((turn) => [turn.ask, ...turn.replies.map(() => turn.ask)])
  const latestTurnKey = turns.at(-1)?.ask
  const input: NativeChatTranscriptSlotsInput = {
    messages,
    turnKeys,
    liveTurnKey: working ? latestTurnKey : undefined,
    receipts: new Map(),
    turnStatuses: { active: null, completedByTurn: {} },
    turnDiffs: new Map(),
    expandedTurnKeys: new Set(turns.map((turn) => turn.ask)),
    isWorking: working,
    lifecycleWorking: false
  }
  return { input, latestTurnKey, rootRows: messages.length }
}

function offer(
  fork: 'checkpoint' | 'tip',
  forkableItemIds: ReadonlySet<string>,
  latestTurnKey: string | undefined,
  contextFloorSequence = 0
) {
  return {
    chat: { support: { kind: 'known', fork }, contextFloorSequence, forkableItemIds },
    latestTurnKey
  } as const
}

describe('the side chat fork point the transcript finds while laying out', () => {
  const finished = (index: number) => ({
    ask: `ask-${index}`,
    replies: [row(`reply-${index}`, 'assistant', index * 10_000 + 1)]
  })

  it('forks a running chat through its last finished response, or waits at a tip', () => {
    const live = { ask: 'ask-live', replies: [row('reply-live', 'assistant', 99_001)] }
    const forkable = new Set(['reply-1', 'reply-live'])
    const { input, latestTurnKey } = conversation([finished(1), live], true)

    expect(
      buildNativeChatTranscript({
        ...input,
        forkOffer: offer('checkpoint', forkable, latestTurnKey)
      }).forkPoint
    ).toEqual({ kind: 'ready', throughItemId: 'reply-1' })
    expect(
      buildNativeChatTranscript({ ...input, forkOffer: offer('tip', forkable, latestTurnKey) })
        .forkPoint
    ).toEqual({ kind: 'reply-running' })

    const done = conversation([finished(1), live], false)
    expect(
      buildNativeChatTranscript({
        ...done.input,
        forkOffer: offer('tip', forkable, done.latestTurnKey)
      }).forkPoint
    ).toEqual({ kind: 'ready', throughItemId: 'reply-live' })
  })

  it('has nothing to fork above a /clear', () => {
    const { input, latestTurnKey } = conversation([finished(1)], false)

    expect(
      buildNativeChatTranscript({
        ...input,
        forkOffer: offer('checkpoint', new Set(['reply-1']), latestTurnKey, 50_000)
      }).forkPoint
    ).toEqual({ kind: 'no-reply' })
  })
})

it('offers inherited ancestor replies in a fork of a fork while the child is running', () => {
  const { input, latestTurnKey } = conversation(
    [
      { ask: 'older-user', replies: [row('legacy:opencode:source:reply-0', 'assistant', 1)] },
      {
        ask: 'inherited-user',
        replies: [row('legacy:opencode:parent-fork:reply-1', 'assistant', 3)]
      },
      { ask: 'own-user', replies: [row('legacy:opencode:child:reply-2', 'assistant', 6)] }
    ],
    true
  )
  const inventory = nativeChatForkInventory([
    {
      itemId: 'legacy:opencode:source:reply-0',
      sequence: 1,
      body: {
        kind: 'message',
        role: 'assistant',
        blocks: [{ type: 'text', text: 'older copied reply' }]
      }
    },
    {
      itemId: 'legacy:opencode:parent-fork:reply-1',
      sequence: 3,
      body: { kind: 'message', role: 'assistant', blocks: [{ type: 'text', text: 'copied' }] }
    },
    {
      itemId: 'orca:forked-from',
      sequence: 4,
      body: { kind: 'status', text: 'Forked from source', presentation: 'forked-from' }
    },
    {
      itemId: 'legacy:opencode:child:reply-2',
      sequence: 6,
      body: {
        kind: 'message',
        role: 'assistant',
        blocks: [{ type: 'text', text: 'local partial' }]
      }
    }
  ])
  const chat = {
    support: { kind: 'known', fork: 'tip', inheritedOriginal: true },
    contextFloorSequence: 0,
    ...inventory
  } as const
  const olderRow = {
    message: row('legacy:opencode:source:reply-0', 'assistant', 1),
    inSubagentSection: false,
    turnWorking: false,
    inLatestTurn: false
  }
  expect(nativeChatRowOffersFork(olderRow, chat)).toBe(true)
  expect(
    nativeChatRowOffersFork(olderRow, {
      ...chat,
      support: { kind: 'known', fork: 'tip' }
    })
  ).toBe(false)
  // Checkpoint providers still offer earlier inherited replies without original-tip support.
  expect(
    nativeChatRowOffersFork(olderRow, {
      ...chat,
      support: { kind: 'known', fork: 'checkpoint' }
    })
  ).toBe(true)
  expect(
    buildNativeChatTranscript({
      ...input,
      forkOffer: { chat: { ...chat, support: { kind: 'known', fork: 'tip' } }, latestTurnKey }
    }).forkPoint
  ).toEqual({ kind: 'reply-running' })
  expect(
    buildNativeChatTranscript({ ...input, forkOffer: { chat, latestTurnKey } }).forkPoint
  ).toEqual({ kind: 'ready', throughItemId: 'legacy:opencode:parent-fork:reply-1' })
  expect(
    buildNativeChatTranscript({
      ...input,
      forkOffer: { chat: { ...chat, contextFloorSequence: 4 }, latestTurnKey }
    }).forkPoint
  ).toEqual({ kind: 'reply-running' })
})


