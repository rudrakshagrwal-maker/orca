import {
  classifyGitCommand,
  findGitSubcommandIndex
} from '../../../shared/git/commands/git-command-classification'
import type { GitExecOptions } from './git-exec-options'

type Output = { stdout: string; stderr: string }
// RA: session metadata reads share results and in-flight work, scoped by host, cwd and argv.
const metadata = new Map<string, Promise<Output>>()

export function invalidateGitSessionMetadata(): void {
  metadata.clear()
}

export function withGitSessionMetadata(
  args: string[],
  options: GitExecOptions,
  run: () => Promise<Output>
): Promise<Output> {
  const command = args[findGitSubcommandIndex(args)]
  if (classifyGitCommand(args) !== 'read') {
    // RA: worktree add/remove and other mutations fence stale refs/config immediately.
    invalidateGitSessionMetadata()
    return run().finally(invalidateGitSessionMetadata)
  }
  if (
    !['config', 'remote', 'for-each-ref'].includes(command) ||
    options.stdin ||
    options.onStderr ||
    options.terminationBarrier ||
    options.observeChildTermination
  ) {
    return run()
  }
  options.signal?.throwIfAborted()
  const key = JSON.stringify([options.cwd, options.wslDistro, options.env, args])
  const existing = metadata.get(key)
  if (existing) {
    return existing.then((output) => {
      options.signal?.throwIfAborted()
      return output
    })
  }
  const promise = run()
  metadata.set(key, promise)
  void promise.catch((error: unknown) => {
    // RA: unset config is stable session metadata; real failures remain retryable.
    const unsetConfig =
      command === 'config' &&
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 1 &&
      'stderr' in error &&
      !error.stderr
    if (!unsetConfig && metadata.get(key) === promise) {
      metadata.delete(key)
    }
  })
  return promise
}
