import { describe, expect, it } from 'vitest'
import {
  stripLeadingAgentTitleDecoration,
  stripLeadingAgentTitleDecorationOrEmpty,
  agentTerminalTitle // RA: keep terminal-owned labels clean across both surfaces.
} from './agent-title-decoration'

describe('stripLeadingAgentTitleDecoration', () => {
  // RA: generated labels must not prepend branch/path context to an agent's own title.
  it.each([
    ['  master · Fix permission prompt  ', 'Fix permission prompt'],
    [' main · C:\\work\\orca · Fix splits ', 'Fix splits'],
    [' /work/orca · Review UI ', 'Review UI'],
    [' ✳ Claude Code ', 'Claude Code'],
    ['Review · terminal focus', 'Review · terminal focus']
  ])('cleans %s to %s', (title, expected) => {
    expect(agentTerminalTitle(title)).toBe(expected)
  })
  it('strips Qoder permission decoration without stripping triangles inside a title', () => {
    expect(stripLeadingAgentTitleDecoration('▲ Qoder CLI')).toBe('Qoder CLI')
    expect(stripLeadingAgentTitleDecoration('deploy ▲ complete')).toBe('deploy ▲ complete')
  })

  it("strips Claude's ✳ idle glyph", () => {
    expect(stripLeadingAgentTitleDecoration('✳ Claude Code')).toBe('Claude Code')
  })

  it("strips Claude's working/idle text prefixes", () => {
    expect(stripLeadingAgentTitleDecoration('. working on the fix')).toBe('working on the fix')
    expect(stripLeadingAgentTitleDecoration('* Claude Code')).toBe('Claude Code')
  })

  it('strips a leading braille spinner', () => {
    expect(stripLeadingAgentTitleDecoration('⠋ Pi')).toBe('Pi')
  })

  it('leaves an undecorated title untouched', () => {
    expect(stripLeadingAgentTitleDecoration('Dolphin-2')).toBe('Dolphin-2')
    expect(stripLeadingAgentTitleDecoration('npm run dev')).toBe('npm run dev')
  })

  it('keeps the original when the title is only a status glyph', () => {
    expect(stripLeadingAgentTitleDecoration('✳')).toBe('✳')
    expect(stripLeadingAgentTitleDecoration('✳ ')).toBe('✳ ')
  })

  it('can strip to empty when the caller supplies its own fallback label', () => {
    expect(stripLeadingAgentTitleDecorationOrEmpty('✳')).toBe('')
    expect(stripLeadingAgentTitleDecorationOrEmpty('✳ ')).toBe('')
  })
})
