import { describe, expect, it } from 'vitest'
import type { WorkspaceSessionState } from '../../shared/workspace-session-state-types'
import { preserveRuntimeAuthoredWorkspaceSessionFields } from './runtime-authored-workspace-session-fields'

const row = {
  v: 1 as const,
  browserPageId: 'page-a',
  workspaceId: 'repo-1::wt-a',
  browserProfileId: 'profile-a',
  executionHostKey: 'native:runtime-a:1',
  url: 'https://kept.internal/',
  title: 'Kept',
  pairedDeviceId: 'device-a',
  savedAt: 1_800_000_000_000
}

describe('preserving runtime-authored workspace session fields', () => {
  // RA: a renderer save cannot erase terminal provenance or retain closed endpoints.
  it('preserves omitted launch parents and retires a link when its parent pane closes', () => {
    const parentLeaf = '11111111-1111-4111-8111-111111111111'
    const childLeaf = '22222222-2222-4222-8222-222222222222'
    const prior: WorkspaceSessionState = {
      ...session(),
      terminalLaunchParentsByPaneKey: { [`child:${childLeaf}`]: `parent:${parentLeaf}` },
      terminalLayoutsByTabId: {
        parent: { root: { type: 'leaf', leafId: parentLeaf }, activeLeafId: parentLeaf, expandedLeafId: null },
        child: { root: { type: 'leaf', leafId: childLeaf }, activeLeafId: childLeaf, expandedLeafId: null }
      }
    }
    const renderer = { ...prior, terminalLaunchParentsByPaneKey: undefined }
    expect(preserveRuntimeAuthoredWorkspaceSessionFields(renderer, prior).terminalLaunchParentsByPaneKey)
      .toEqual(prior.terminalLaunchParentsByPaneKey)
    const closed = { ...renderer, terminalLayoutsByTabId: { child: prior.terminalLayoutsByTabId.child } }
    expect(preserveRuntimeAuthoredWorkspaceSessionFields(closed, prior).terminalLaunchParentsByPaneKey)
      .toEqual({})
  })

  it('carries the rows across a write that never mentions them', () => {
    // Zustand snapshots omit pages persisted by the runtime sharing this profile.
    const next = preserveRuntimeAuthoredWorkspaceSessionFields(
      session(),
      session({ 'repo-1::wt-a': [row] })
    )

    expect(next.clientHostedBrowserPagesByWorktree).toEqual({ 'repo-1::wt-a': [row] })
  })

  it('lets the runtime clear its own rows, which it does with an empty map', () => {
    const next = preserveRuntimeAuthoredWorkspaceSessionFields(
      session({}),
      session({ 'repo-1::wt-a': [row] })
    )

    expect(next.clientHostedBrowserPagesByWorktree).toEqual({})
  })

  it('lets the runtime replace its rows outright', () => {
    const replaced = { 'repo-1::wt-b': [{ ...row, workspaceId: 'repo-1::wt-b' }] }

    expect(
      preserveRuntimeAuthoredWorkspaceSessionFields(
        session(replaced),
        session({ 'repo-1::wt-a': [row] })
      ).clientHostedBrowserPagesByWorktree
    ).toEqual(replaced)
  })

  it('treats an explicit undefined as never having mentioned the field', () => {
    // Explicit undefined still means the writer lacks this field; inherit rather than clear.
    const next = preserveRuntimeAuthoredWorkspaceSessionFields(
      { ...session(), clientHostedBrowserPagesByWorktree: undefined },
      session({ 'repo-1::wt-a': [row] })
    )

    expect(next.clientHostedBrowserPagesByWorktree).toEqual({ 'repo-1::wt-a': [row] })
  })

  it('leaves an untouched write alone rather than inventing a field', () => {
    const next = session()

    expect(preserveRuntimeAuthoredWorkspaceSessionFields(next, session())).toBe(next)
    expect(preserveRuntimeAuthoredWorkspaceSessionFields(next, null)).toBe(next)
  })

  it('keeps default-terminal-tab markers a persist snapshot omitted', () => {
    const next = preserveRuntimeAuthoredWorkspaceSessionFields(session(), {
      ...session(),
      defaultTerminalTabsAppliedByWorktreeId: { 'repo-1::/wt-a': true }
    })

    expect(next.defaultTerminalTabsAppliedByWorktreeId).toEqual({ 'repo-1::/wt-a': true })
  })

  it('unions default-terminal-tab markers instead of replacing with a partial snapshot', () => {
    const next = preserveRuntimeAuthoredWorkspaceSessionFields(
      { ...session(), defaultTerminalTabsAppliedByWorktreeId: { 'repo-1::/wt-b': true } },
      { ...session(), defaultTerminalTabsAppliedByWorktreeId: { 'repo-1::/wt-a': true } }
    )

    expect(next.defaultTerminalTabsAppliedByWorktreeId).toEqual({
      'repo-1::/wt-a': true,
      'repo-1::/wt-b': true
    })
  })
})

function session(
  clientHostedBrowserPagesByWorktree?: WorkspaceSessionState['clientHostedBrowserPagesByWorktree']
): WorkspaceSessionState {
  return {
    activeRepoId: null,
    activeWorktreeId: null,
    activeTabId: null,
    tabsByWorktree: {},
    terminalLayoutsByTabId: {},
    ...(clientHostedBrowserPagesByWorktree ? { clientHostedBrowserPagesByWorktree } : {})
  }
}
