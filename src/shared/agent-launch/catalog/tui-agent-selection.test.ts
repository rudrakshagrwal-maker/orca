import { describe, expect, it } from 'vitest'
import { isTuiAgentEnabled, normalizeDisabledTuiAgents, pickTuiAgent } from './tui-agent-selection'

describe('pickTuiAgent', () => {
  // RA: saved preferences cannot launch an agent removed from this fork.
  it('falls back from Hermes and refuses inventories containing only removed agents', () => {
    expect(pickTuiAgent('hermes', ['hermes', 'codex'])).toBe('codex')
    expect(pickTuiAgent(null, ['gemini', 'opencode', 'hermes'])).toBeNull()
  })
  it('respects the explicit blank terminal preference', () => {
    expect(pickTuiAgent('blank', ['cursor', 'claude'])).toBeNull()
  })

  it('ignores disabled preferred and fallback agents', () => {
    expect(pickTuiAgent('codex', ['claude', 'codex'], ['codex'])).toBe('claude')
    expect(pickTuiAgent(null, ['claude', 'codex'], ['claude', 'codex'])).toBeNull()
  })
})

describe('normalizeDisabledTuiAgents', () => {
  it('dedupes supported agent ids and drops unsupported values', () => {
    expect(normalizeDisabledTuiAgents(['codex', 'unknown', 'codex', null, 'claude'])).toEqual([
      'codex',
      'claude'
    ])
  })
})

// RA: the fork allows Claude Code and Codex only.
describe('fork agent allow-list', () => {
  it('enables exactly claude and codex', () => {
    expect(isTuiAgentEnabled('claude')).toBe(true)
    expect(isTuiAgentEnabled('codex')).toBe(true)
    expect(isTuiAgentEnabled('hermes')).toBe(false)
    expect(pickTuiAgent(null, ['hermes'])).toBeNull()
  })
})
