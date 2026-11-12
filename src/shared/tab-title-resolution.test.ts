// RA: Agent OSC titles must survive launch/saved-name decoration and whitespace.
import { describe, expect, it } from 'vitest'
import { resolveAgentSessionTitle, resolveTerminalTabTitle } from './tab-title-resolution'

describe('agent terminal tab titles', () => {
  // RA: numbered placeholders must never beat an agent's actual session name.
  it('uses live, provider, generated and agent fallbacks consistently', () => {
    const tab = {
      title: 'Terminal 2',
      customTitle: null,
      generatedTitle: 'Prompt summary',
      quickCommandLabel: 'Launch',
      aiVaultTitle: { agent: 'claude' as const, sessionId: 'session', title: 'Saved session' }
    }
    expect(resolveAgentSessionTitle(tab, '✳ Live session', 'Claude')).toBe('Live session')
    expect(resolveAgentSessionTitle(tab, 'Terminal 3', 'Claude')).toBe('Saved session')
    expect(resolveAgentSessionTitle(tab, 'Terminal 3', 'Claude', 'another-session')).toBe(
      'Prompt summary'
    )
    expect(resolveAgentSessionTitle({ ...tab, aiVaultTitle: null }, 'Claude', 'Claude')).toBe(
      'Prompt summary'
    )
    expect(
      resolveAgentSessionTitle(
        { ...tab, aiVaultTitle: null, generatedTitle: null, quickCommandLabel: null },
        null,
        'Claude'
      )
    ).toBe('Claude')
    expect(
      resolveAgentSessionTitle({ ...tab, customTitle: 'My name' }, 'Live session', 'Claude')
    ).toBe('My name')
  })
  it.each(['claude', 'codex'] as const)(
    'prefers the live %s title over branch/path labels',
    (agent) => {
      expect(
        resolveTerminalTabTitle(
          {
            title: '  Fix terminal input  ',
            ptyId: 'pty-live',
            launchAgent: agent,
            quickCommandLabel: 'master · Claude',
            generatedTitle: 'C:\\repo\\orca · Generated task',
            aiVaultTitle: { agent, sessionId: 'session', title: 'Saved conversation' }
          },
          true
        )
      ).toBe('Fix terminal input')
    }
  )

  it('recognizes a manually launched agent title without launch metadata', () => {
    expect(
      resolveTerminalTabTitle({ title: '  Codex  ', generatedTitle: 'master · Old task' }, true)
    ).toBe('Codex')
  })

  it('keeps explicit renames and ordinary shell title fallbacks', () => {
    expect(resolveTerminalTabTitle({ title: 'Codex', customTitle: '  Review  ' }, true)).toBe(
      'Review'
    )
    expect(resolveTerminalTabTitle({ title: 'zsh', quickCommandLabel: 'Build' }, true)).toBe(
      'Build'
    )
    expect(
      resolveTerminalTabTitle({ title: '   ', launchAgent: 'claude' }, false, 'Terminal')
    ).toBe('Terminal')
  })

  it('keeps the saved conversation name for a sleeping terminal with a stale OSC title', () => {
    expect(
      resolveTerminalTabTitle(
        {
          title: 'Codex',
          ptyId: null,
          launchAgent: 'codex',
          aiVaultTitle: { agent: 'codex', sessionId: 'session', title: 'Saved conversation' }
        },
        false
      )
    ).toBe('Saved conversation')
  })
})
