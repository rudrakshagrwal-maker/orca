import { describe, expect, it } from 'vitest'
import { findTerminalWaitBlockedSignal } from '../../agent-state-rules/blocked-text-layer'
import { isCodexBusyScreen } from '../../agent-state-rules/codex-screen-predicates'
import { isClaudeBusyScreen, isClaudeInputDialogScreen } from './claude-screen-state'
import { readScreenBusy, readScreenInputVeto } from './screen-input-veto'
import { evaluateTuiIdle, type TuiIdleEvaluationInput } from './tui-idle-evidence'

// RA: screens follow herdr's claude.toml/codex.toml shapes; each array is the painted bottom of the grid.
const RULE = '─'.repeat(40)
const PROMPT_BOX = [RULE, '❯ ', RULE, '  ? for shortcuts']

const MCP_DIALOG = [
  'MCP server "linear" requests your input',
  '',
  '  Which team?',
  '❯ Accept',
  '  Decline',
  '',
  '  Esc to cancel'
]
const FORM = [
  '  Pick one',
  '❯ 1. Alpha',
  '  2. Beta',
  '',
  '  Enter to select · ↑/↓ to navigate · Esc to cancel'
]

describe('isClaudeInputDialogScreen', () => {
  it('sees the MCP elicitation dialog and live selection forms', () => {
    expect(isClaudeInputDialogScreen(MCP_DIALOG)).toBe(true)
    expect(isClaudeInputDialogScreen(['  Plan', '  Enter to confirm · Esc to cancel'])).toBe(true)
    expect(isClaudeInputDialogScreen(FORM)).toBe(true)
  })
  it('holds for the transcript viewer and the model picker', () => {
    expect(isClaudeInputDialogScreen(['Showing detailed transcript · ctrl+o to toggle'])).toBe(
      true
    )
    expect(
      isClaudeInputDialogScreen([
        'Select model',
        '❯ 1. Opus',
        'Enter to set as default · Esc to cancel'
      ])
    ).toBe(true)
  })
  it('ignores dialog text quoted above a live prompt box', () => {
    expect(isClaudeInputDialogScreen([...MCP_DIALOG, ...PROMPT_BOX])).toBe(false)
    expect(isClaudeInputDialogScreen([...FORM, ...PROMPT_BOX])).toBe(false)
  })
  it('does not fire on a bare header with no controls', () => {
    expect(
      isClaudeInputDialogScreen(['MCP server "linear" requests your input', '  Esc to cancel'])
    ).toBe(false)
  })
})

describe('isClaudeBusyScreen', () => {
  it('sees interrupt rows, spinner rows, background agents and MCP tasks', () => {
    const busy = (row: string) => isClaudeBusyScreen([row, ...PROMPT_BOX])
    expect(busy('⏵⏵ accept edits on · esc to interrupt')).toBe(true)
    expect(busy('✻ Cogitating… (12s · esc to interrupt)')).toBe(true)
    expect(busy('✶ Waiting for 2 background agents to finish')).toBe(true)
    expect(busy('✶ Churned for 1m · 1 MCP task still running')).toBe(true)
  })
  it('ignores idle screens and quoted or indented rows', () => {
    const busy = (row: string) => isClaudeBusyScreen([row, ...PROMPT_BOX])
    expect(busy('● Done.')).toBe(false)
    expect(busy('❯ say esc to interrupt')).toBe(false)
    expect(busy('❯ ✶ Waiting for 2 background agents to finish')).toBe(false)
  })
})

describe('screen vetoes in the idle ranking', () => {
  const screen = (lines: string[]) => () => ({ lines, alternateScreen: false })
  it('registers a Claude dialog veto and busy read; null without a rule', () => {
    expect(readScreenInputVeto('claude', screen(MCP_DIALOG))).toBe(true)
    expect(readScreenInputVeto('claude', screen(PROMPT_BOX))).toBe(false)
    expect(readScreenBusy('claude', screen(['⏵ x · esc to interrupt']))).toBe(true)
    expect(readScreenInputVeto('cursor', screen(MCP_DIALOG))).toBeNull()
  })

  function input(over: Partial<TuiIdleEvaluationInput>): TuiIdleEvaluationInput {
    return {
      record: { lastAgentStatus: 'idle', lastOutputAt: 0, lastOscTitle: '✳ Claude Code' },
      readTailBlockedReason: () => null,
      readPositiveBodyEvidence: () => false,
      readQuietReadyBodyEvidence: () => false,
      readAgentRuleVerdict: () => null,
      readScreenInputVeto: () => false,
      titleObservedAtEpochMs: null,
      agent: 'claude',
      firstPartyStatus: null,
      quiescenceMs: 1,
      ...over
    }
  }
  it('an idle title is ready, but not over a live dialog or a busy row', () => {
    expect(evaluateTuiIdle(input({})).kind).toBe('ready-strong')
    expect(evaluateTuiIdle(input({ readScreenInputVeto: () => true })).kind).toBe('pending')
    expect(evaluateTuiIdle(input({ readScreenBusy: () => true })).kind).toBe('pending')
  })
  it('a fresh hook done stays authoritative over a busy row', () => {
    const verdict = evaluateTuiIdle(
      input({
        readScreenBusy: () => true,
        readHookTurn: () => ({ state: 'done', blockedReason: null })
      })
    )
    expect(verdict.kind).toBe('ready-strong')
  })
})

describe('blocked text signals', () => {
  const text = (lines: string[]) => lines.join('\n').toLowerCase()
  it('flags a live MCP dialog in the tail, even with folded spaces', () => {
    expect(findTerminalWaitBlockedSignal(text(MCP_DIALOG))?.reason).toBe('agent-interactive-prompt')
    const folded = text(MCP_DIALOG).replace(/ /g, '')
    expect(findTerminalWaitBlockedSignal(folded)?.reason).toBe('agent-interactive-prompt')
  })
  it('ignores an MCP dialog already answered and followed by chat', () => {
    const answered = [...MCP_DIALOG, 'Thanks, using team A', 'Reading files', ...PROMPT_BOX]
    expect(findTerminalWaitBlockedSignal(text(answered))).toBeNull()
  })
  it('flags Codex approval and question dialogs, not answered ones', () => {
    const live = [
      'Allow command?',
      '  1. Yes',
      '  2. No',
      '',
      'Press enter to confirm or esc to cancel'
    ]
    expect(findTerminalWaitBlockedSignal(text(live))?.reason).toBe('agent-interactive-prompt')
    const answered = [...live, 'Ran ls', 'o1', 'o2', 'o3', 'o4', 'o5', '› write tests']
    expect(findTerminalWaitBlockedSignal(text(answered))).toBeNull()
  })
})

describe('RA: live dialog liveness', () => {
  const text = (lines: string[]) => lines.join('\n').toLowerCase()
  it('blocks a live allow-command question with no composer row, not one with the composer below', () => {
    const q = ['Allow command?', '  1. Yes', '  2. No']
    expect(findTerminalWaitBlockedSignal(text(q))?.reason).toBe('agent-interactive-prompt')
    expect(findTerminalWaitBlockedSignal(text([...q, '› Ask Codex to do anything']))).toBeNull()
  })
  it('blocks a press-enter dialog that has option rows below it', () => {
    const live = [
      'Codex needs permission to run a command',
      'Press enter to continue',
      '  1. Yes',
      '  2. No',
      '  3. Always',
      '  4. Never'
    ]
    expect(findTerminalWaitBlockedSignal(text(live))?.reason).toBe('agent-interactive-prompt')
  })
})

describe('press-enter footer liveness', () => {
  const text = (lines: string[]) => lines.join('\n').toLowerCase()
  const dialog = [
    'Codex needs permission to run a command',
    '  1. Yes',
    '  2. No',
    'Press enter to confirm or esc to cancel'
  ]
  it('blocks while the footer ends the screen', () => {
    expect(findTerminalWaitBlockedSignal(text(dialog))?.reason).toBe('agent-interactive-prompt')
  })
  it('does not block an answered dialog with the Codex composer below it', () => {
    const answered = [...dialog, '• Ran ls', '› Ask Codex to do anything']
    expect(findTerminalWaitBlockedSignal(text(answered))).toBeNull()
  })
})

describe('isCodexBusyScreen', () => {
  const composer = '› Ask Codex to do anything'
  it('sees the timer status row with and without the interrupt hint', () => {
    expect(isCodexBusyScreen(['• Working (12s • esc to interrupt)', '', composer])).toBe(
      true
    )
    expect(isCodexBusyScreen(['• Working (1m 12s)', '', composer])).toBe(true)
  })
  it('ignores finished turns, failed reconnects and old timers above chat', () => {
    expect(isCodexBusyScreen(['─ Worked for 12s ─', '', composer])).toBe(false)
    expect(
      isCodexBusyScreen([
        '• Reconnect failed — check the endpoint, then relaunch (12s)',
        composer
      ])
    ).toBe(false)
    expect(isCodexBusyScreen(['• Working (12s)', 'a', 'b', 'c', 'd', composer])).toBe(false)
  })
  // RA: a final message ending in a duration is chat, not a running turn.
  it('ignores a final message that ends in a timer', () => {
    expect(isCodexBusyScreen(['Build finished (12s)', '', composer])).toBe(false)
    expect(isCodexBusyScreen(['• Working (12s)', 'Build finished (12s)', composer])).toBe(false)
    expect(isCodexBusyScreen(['Working (12s)', '  └ tip: use /help', composer])).toBe(true)
  })
})
