import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'
import { runProcess } from '@orca/process-host'

it.runIf(process.platform === 'win32')(
  'preserves official Orca shortcuts during fork installation',
  async () => {
    const result = await runProcess({
      program: 'powershell.exe',
      args: [
        '-NoProfile',
        '-NonInteractive',
        '-File',
        fileURLToPath(new URL('../../scripts/ra-install-shortcuts.test.ps1', import.meta.url))
      ],
      timeoutMs: 20_000
    })
    expect(result.stderr).toBe('')
    expect(result.code).toBe(0)
  }
)
