import { beforeEach, expect, it } from 'vitest'
import { invalidateGitSessionMetadata, withGitSessionMetadata } from './git-session-metadata-cache'

beforeEach(invalidateGitSessionMetadata)

// RA: Git uses exit 1 for an unset key; repeated absence must not respawn Git.
it('retains missing config until explicit invalidation', async () => {
  const args = ['config', '--get', 'core.untrackedCache']
  const options = { cwd: '/repo' }
  const missing = Object.assign(new Error('unset'), { code: 1, stderr: '' })
  await expect(
    withGitSessionMetadata(args, options, async () => {
      throw missing
    })
  ).rejects.toBe(missing)
  await expect(
    withGitSessionMetadata(args, options, async () => ({ stdout: 'true', stderr: '' }))
  ).rejects.toBe(missing)
  invalidateGitSessionMetadata()
  await expect(
    withGitSessionMetadata(args, options, async () => ({ stdout: 'true', stderr: '' }))
  ).resolves.toEqual({ stdout: 'true', stderr: '' })
})

// RA: metadata stays stable for a session, then explicit refresh or mutation exposes new values.
it('shares config, remote and ref reads and invalidates them after worktree mutation', async () => {
  for (const args of [
    ['config', '--get', 'remote.origin.url'],
    ['remote', '-v'],
    ['for-each-ref', '--format=%(refname)']
  ]) {
    const options = { cwd: '/repo', wslDistro: 'Ubuntu' }
    expect(
      await withGitSessionMetadata(args, options, async () => ({ stdout: 'before', stderr: '' }))
    ).toEqual({ stdout: 'before', stderr: '' })
    expect(
      await withGitSessionMetadata(args, options, async () => ({ stdout: 'changed', stderr: '' }))
    ).toEqual({ stdout: 'before', stderr: '' })
    await withGitSessionMetadata(['worktree', 'add', '/repo/child'], options, async () => ({
      stdout: '',
      stderr: ''
    }))
    expect(
      await withGitSessionMetadata(args, options, async () => ({ stdout: 'after', stderr: '' }))
    ).toEqual({ stdout: 'after', stderr: '' })
    invalidateGitSessionMetadata()
    expect(
      await withGitSessionMetadata(args, options, async () => ({ stdout: 'explicit', stderr: '' }))
    ).toEqual({ stdout: 'explicit', stderr: '' })
  }
})

it('keeps different hosts separate and never caches status or config writes', async () => {
  const args = ['config', '--get', 'remote.origin.url']
  await withGitSessionMetadata(args, { cwd: '/repo' }, async () => ({
    stdout: 'native',
    stderr: ''
  }))
  expect(
    await withGitSessionMetadata(args, { cwd: '/repo', wslDistro: 'Ubuntu' }, async () => ({
      stdout: 'guest',
      stderr: ''
    }))
  ).toEqual({ stdout: 'guest', stderr: '' })
  await withGitSessionMetadata(
    ['config', 'remote.origin.url', 'new'],
    { cwd: '/repo' },
    async () => ({ stdout: '', stderr: '' })
  )
  expect(
    await withGitSessionMetadata(args, { cwd: '/repo' }, async () => ({
      stdout: 'new',
      stderr: ''
    }))
  ).toEqual({ stdout: 'new', stderr: '' })
  await withGitSessionMetadata(['status', '--porcelain=v2'], { cwd: '/repo' }, async () => ({
    stdout: 'clean',
    stderr: ''
  }))
  expect(
    await withGitSessionMetadata(['status', '--porcelain=v2'], { cwd: '/repo' }, async () => ({
      stdout: 'dirty',
      stderr: ''
    }))
  ).toEqual({ stdout: 'dirty', stderr: '' })
})
