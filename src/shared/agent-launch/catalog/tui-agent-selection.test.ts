import { describe, expect, it } from 'vitest'
import { isTuiAgentEnabled, normalizeDisabledTuiAgents, pickTuiAgent } from './tui-agent-selection'

describe('pickTuiAgent', () => {
  it('honors Hermes and dsh preferences and refuses removed agents', () => {
    expect(pickTuiAgent('hermes', ['hermes', 'codex'])).toBe('hermes')
    expect(pickTuiAgent('dsh', ['hermes', 'dsh'])).toBe('dsh')
    expect(pickTuiAgent(null, ['gemini', 'opencode', 'pi', 'omp'])).toBeNull()
  })

  it('falls back in launcher order regardless of inventory order', () => {
    expect(pickTuiAgent(null, ['dsh', 'hermes', 'codex', 'claude'])).toBe('claude')
    expect(pickTuiAgent(null, ['dsh', 'hermes', 'codex'])).toBe('codex')
    expect(pickTuiAgent(null, ['dsh', 'hermes'])).toBe('hermes')
    expect(pickTuiAgent(null, ['dsh'])).toBe('dsh')
  })
  it('respects the explicit blank terminal preference', () => {
    expect(pickTuiAgent('blank', ['cursor', 'claude'])).toBeNull()
  })

  it('ignores disabled preferred and fallback agents', () => {
    expect(pickTuiAgent('codex', ['claude', 'codex'], ['codex'])).toBe('claude')
    expect(pickTuiAgent(null, ['claude', 'codex'], ['claude', 'codex'])).toBeNull()
    expect(pickTuiAgent('hermes', ['hermes', 'dsh'], ['hermes'])).toBe('dsh')
    expect(pickTuiAgent('dsh', ['hermes', 'dsh'], ['hermes', 'dsh'])).toBeNull()
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

describe('fork agent allow-list', () => {
  it('enables the four launch agents and keeps removed agents disabled', () => {
    expect(isTuiAgentEnabled('claude')).toBe(true)
    expect(isTuiAgentEnabled('codex')).toBe(true)
    expect(isTuiAgentEnabled('hermes')).toBe(true)
    expect(isTuiAgentEnabled('dsh')).toBe(true)
    expect(isTuiAgentEnabled('pi')).toBe(false)
    expect(isTuiAgentEnabled('omp')).toBe(false)
    expect(isTuiAgentEnabled('opencode')).toBe(false)
  })
})
