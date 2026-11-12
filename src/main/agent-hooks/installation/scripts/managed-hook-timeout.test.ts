import { describe, expect, it } from 'vitest'
import { runProcessSync } from '@orca/process-host'
import { buildPosixAgentHookPostCommand } from './hook-post-command'
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// RA: only pure transport behavior remains; Codex hook installation is cut.
describe('managed agent hook timeouts', () => {
  it.skipIf(process.platform === 'win32').each(['raw-json-v1', ''])(
    'scopes the C numeric locale to the custom curl command for transport %s',
    (transport) => {
      const tmpDir = mkdtempSync(join(tmpdir(), 'orca-custom-curl-locale-'))
      try {
        const curlPath = join(tmpDir, 'curl with spaces')
        const observed = join(tmpDir, 'curl-locale')
        const shellObserved = join(tmpDir, 'shell-locale')
        const payloadPath = join(tmpDir, 'custom-curl-payload')
        writeFileSync(
          curlPath,
          '#!/bin/sh\nprintf "%s|%s" "$LC_ALL" "$LC_NUMERIC" > "$ORCA_TEST_CURL_LOCALE"\ncat > "$ORCA_TEST_CURL_PAYLOAD"\n'
        )
        chmodSync(curlPath, 0o755)
        const payload = '{"prompt":"漢字 $HOME & quoted"}'
        const command = [
          'payload="$ORCA_TEST_PAYLOAD"',
          'curl_bin="$ORCA_TEST_CURL_BIN"',
          ...buildPosixAgentHookPostCommand('codex', { curlCommand: '"$curl_bin"' }),
          'printf "%s|%s" "$LC_ALL" "$LC_NUMERIC" > "$ORCA_TEST_SHELL_LOCALE"'
        ].join('\n')
        const result = runProcessSync({
          program: '/bin/sh',
          args: ['-c', command],
          env: {
            PATH: '/usr/bin:/bin',
            LC_ALL: 'de_DE.UTF-8',
            LC_NUMERIC: 'de_DE.UTF-8',
            ORCA_AGENT_HOOK_TRANSPORT: transport,
            ORCA_AGENT_HOOK_PORT: '1234',
            ORCA_AGENT_HOOK_TOKEN: 'token',
            ORCA_TEST_CURL_BIN: curlPath,
            ORCA_TEST_CURL_LOCALE: observed,
            ORCA_TEST_SHELL_LOCALE: shellObserved,
            ORCA_TEST_CURL_PAYLOAD: payloadPath,
            ORCA_TEST_PAYLOAD: payload
          },
          timeoutMs: 5000
        })
        expect(result.timedOut).toBe(false)
        expect(result.code, result.stderr.toString()).toBe(0)
        expect(existsSync(observed)).toBe(true)
        expect(readFileSync(observed, 'utf8')).toBe('|C')
        expect(readFileSync(shellObserved, 'utf8')).toBe('de_DE.UTF-8|de_DE.UTF-8')
        expect(readFileSync(payloadPath, 'utf8')).toBe(payload)
      } finally {
        rmSync(tmpDir, { recursive: true, force: true })
      }
    }
  )

})
