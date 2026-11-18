import { describe, expect, it, vi } from 'vitest'
import { createAgentStatusTracker } from './agent-title-status'
import { hermesNativeTitleStatus } from './providers/hermes-terminal-title'
import { recognizeAgentProcessFromCommandLine } from '../process/agent-process-recognition'

describe('Hermes and dsh terminal status without managed hooks', () => {
  it('tracks a dsh working turn back to its native idle title', () => {
    const idle = vi.fn()
    const working = vi.fn()
    const tracker = createAgentStatusTracker(idle, working)

    tracker.handleTitle('✦ 🐋 Orca')
    expect(working).not.toHaveBeenCalled()
    tracker.handleTitle('⠋ 🐋 Orca')
    expect(working).toHaveBeenCalled()
    tracker.handleTitle('✦ 🐋 Orca')
    expect(idle).toHaveBeenCalledWith('✦ 🐋 Orca', 'idle')
  })

  it.each([
    ['✓ model · workspace', 'idle'],
    ['⏳ model · workspace', 'working'],
    ['⚠ model · workspace', 'permission']
  ] as const)('reads Hermes native title %s only in a Hermes pane', (title, status) => {
    expect(hermesNativeTitleStatus(title, 'hermes')).toBe(status)
    expect(hermesNativeTitleStatus(title, 'codex')).toBeNull()
  })

  it.each([
    ['C:\\Users\\RA\\AppData\\Local\\hermes\\bin\\hermes.exe --tui', 'hermes'],
    ['python -I -c "import hermes_bootstrap; hermes_bootstrap.main()"', 'hermes'],
    ['dsh --profile dsh-tui', 'dsh'],
    ['dsh-tui .', 'dsh'],
    [
      'node C:/Users/RA/AppData/Roaming/npm/node_modules/@deepseek-ai/dsh/lib/bin.js --profile dsh-tui',
      'dsh'
    ]
  ])('recognizes the foreground agent in %s', (command, agent) => {
    expect(recognizeAgentProcessFromCommandLine(command)?.agent).toBe(agent)
  })

  it('does not treat the harness web server as a terminal agent', () => {
    expect(recognizeAgentProcessFromCommandLine('dsh --profile web')).toBeNull()
  })
})
