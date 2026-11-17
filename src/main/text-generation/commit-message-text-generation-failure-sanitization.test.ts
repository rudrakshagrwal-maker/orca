import { describe, expect, it } from 'vitest'
import { generateCommitMessageFromContext } from './commit-message-text-generation'

describe('generateCommitMessageFromContext', () => {
  it('exposes raw CLI failure output only after path sanitization', async () => {
    const result = await generateCommitMessageFromContext(
      {
        branch: 'main',
        stagedSummary: 'M\tREADME.md',
        stagedPatch: '+hello'
      },
      {
        agentId: 'custom',
        model: '',
        customAgentCommand: 'agent'
      },
      {
        kind: 'remote',
        cwd: '/repo',
        missingBinaryLocation: 'remote PATH',
        execute: async () => ({
          stdout: 'You are generating a single git commit message for /secret/repo',
          stderr: 'raw failure output with /Users/thebr/My Repo/secret/file.ts',
          exitCode: 1,
          timedOut: false
        })
      }
    )

    expect(result).toMatchObject({
      success: false,
      error: 'agent CLI command failed with code 1: raw failure output with [path]'
    })
  })

  it('formats nonzero exit failures with extracted sanitized CLI details', async () => {
    const result = await generateCommitMessageFromContext(
      {
        branch: 'main',
        stagedSummary: 'M\tREADME.md',
        stagedPatch: '+hello'
      },
      {
        agentId: 'custom',
        model: '',
        customAgentCommand: 'agent'
      },
      {
        kind: 'remote',
        cwd: '/repo',
        missingBinaryLocation: 'remote PATH',
        execute: async () => ({
          stdout: 'ERROR: fatal: C:\\Users\\Brennan Doe\\secret\\file.ts failed',
          stderr: '',
          exitCode: 1,
          timedOut: false
        })
      }
    )

    expect(result).toMatchObject({
      success: false,
      error: 'agent CLI command failed with code 1: ERROR: fatal: [path] failed'
    })
  })

  it('redacts UNC paths in CLI failure details', async () => {
    const result = await generateCommitMessageFromContext(
      {
        branch: 'main',
        stagedSummary: 'M\tREADME.md',
        stagedPatch: '+hello'
      },
      {
        agentId: 'custom',
        model: '',
        customAgentCommand: 'agent'
      },
      {
        kind: 'remote',
        cwd: '/repo',
        missingBinaryLocation: 'remote PATH',
        execute: async () => ({
          stdout: '',
          stderr: 'ERROR: failed at \\\\server\\share\\Brennan Repo\\secret\\file.ts',
          exitCode: 1,
          timedOut: false
        })
      }
    )

    expect(result).toMatchObject({
      success: false,
      error: 'agent CLI command failed with code 1: ERROR: failed at [path]'
    })
  })

  it('preserves slash-commands while redacting multi-segment paths in failure detail', async () => {
    const result = await generateCommitMessageFromContext(
      {
        branch: 'main',
        stagedSummary: 'M\tREADME.md',
        stagedPatch: '+hello'
      },
      {
        agentId: 'custom',
        model: '',
        customAgentCommand: 'agent'
      },
      {
        kind: 'remote',
        cwd: '/repo',
        missingBinaryLocation: 'remote PATH',
        execute: async () => ({
          stdout: '',
          stderr: 'ERROR: run /login then check /Users/name/repo',
          exitCode: 1,
          timedOut: false
        })
      }
    )

    expect(result).toMatchObject({
      success: false,
      error: 'agent CLI command failed with code 1: ERROR: run /login then check [path]'
    })
  })





  it.each([
    [
      'comma-prefixed list path',
      '401: {"message":"candidate list a,/Users/name/creds rejected"}',
      'Pi CLI command failed with code 1: 401: {"message":"candidate list a,[path] rejected"}'
    ],
    [
      'non-drive colon-prefixed path',
      '401: {"message":"slot 1:/Users/name/alt failed"}',
      'Pi CLI command failed with code 1: 401: {"message":"slot 1:[path] failed"}'
    ]
  ])('redacts a %s in provider bodies', async (_variant, stderr, expected) => {
    const result = await generateCommitMessageFromContext(
      {
        branch: 'main',
        stagedSummary: 'M\tREADME.md',
        stagedPatch: '+hello'
      },
      {
        agentId: 'pi',
        model: 'github-copilot/gpt-5.5'
      },
      {
        kind: 'remote',
        cwd: '/repo',
        missingBinaryLocation: 'remote PATH',
        execute: async () => ({
          stdout: '',
          stderr,
          exitCode: 1,
          timedOut: false
        })
      }
    )

    expect(result).toMatchObject({ success: false, error: expected })
  })
})
