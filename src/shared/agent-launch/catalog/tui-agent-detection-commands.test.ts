import { describe, expect, it } from 'vitest'
import {
  KNOWN_TUI_AGENT_DETECTION_COMMANDS,
  resolveDetectedTuiAgentIds
} from './tui-agent-detection-commands'

describe('fork agent detection', () => {
  it.each(['win32', 'linux', 'darwin', 'wsl'] as const)(
    'detects the installed harness without a community wrapper on %s',
    (runtime) => {
      expect(
        resolveDetectedTuiAgentIds(
          KNOWN_TUI_AGENT_DETECTION_COMMANDS,
          new Set(['dsh', 'hermes', 'claude', 'codex', 'opencode', 'pi', 'omp']),
          runtime
        )
      ).toEqual(['claude', 'codex', 'hermes', 'dsh'])
    }
  )

  it('omits agents whose executables are absent', () => {
    expect(
      resolveDetectedTuiAgentIds(KNOWN_TUI_AGENT_DETECTION_COMMANDS, new Set(['hermes']), 'win32')
    ).toEqual(['hermes'])
  })
})
