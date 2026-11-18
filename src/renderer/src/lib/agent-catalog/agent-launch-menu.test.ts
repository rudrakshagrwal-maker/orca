import { expect, it } from 'vitest'
import { buildAgentCatalogEntries } from './agent-catalog-entries'
import { buildNewTabAgentMenuRows } from '../../../../shared/agent-launch/picker/agent-launch-picker-rows'

it('offers only Claude, Codex, Hermes and dsh as terminal launches in catalog order', () => {
  const rows = buildNewTabAgentMenuRows({
    settings: null,
    detectedOnHost: buildAgentCatalogEntries().map((entry) => entry.id),
    chatAgents: [],
    hostChatAnswer: () => 'no-chats',
    chatProgram: () => 'missing'
  })

  expect(rows).toEqual([
    { kind: 'terminal', agent: 'claude' },
    { kind: 'terminal', agent: 'codex' },
    { kind: 'terminal', agent: 'hermes' },
    { kind: 'terminal', agent: 'dsh' }
  ])
})
