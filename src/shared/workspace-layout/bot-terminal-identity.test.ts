// RA: Bot reconnect identity survives the same loader/serializer/publication as ordinary tabs.
import { describe, expect, it } from 'vitest'
import { localDesktopSession } from './workspace-layout-profile.test-fixture'
import { GIT_KEY } from './workspace-layout-session.test-fixture'
import { nameBasedLoadContext } from './workspace-layout-minted-ids'
import { loadWorkspaceLayout } from './workspace-layout-load'
import { saveWorkspaceLayout } from './workspace-layout-save'
import { publishWorkspaceLayout } from './workspace-layout-published'
import { workspaceLayoutFromPublished } from './workspace-layout-from-published'
describe('bot terminal persistence', () => {
  it('retains profile, home and remote path across disk and window adoption', () => {
    const session = localDesktopSession()
    const row = session.tabsByWorktree[GIT_KEY]![0]!
    row.botProfile = { key: 'hermes:hermes@100.65.84.89:default', id: 'default', source: 'hermes', home: '/home/hermes', remotePath: '/home/hermes' }
    const loaded = loadWorkspaceLayout('local', session, nameBasedLoadContext())
    const saved = saveWorkspaceLayout(loaded)
    expect(saved.tabsByWorktree[GIT_KEY]?.find((tab) => tab.id === row.id)?.botProfile).toEqual({ key: 'hermes:hermes@100.65.84.89:default', id: 'default', source: 'hermes', home: '/home/hermes', remotePath: '/home/hermes' })
    const published = publishWorkspaceLayout(loaded.layout.workspaces[GIT_KEY]!, 'local')
    const adopted = workspaceLayoutFromPublished(published)
    const terminal = adopted.tabs.find((tab) => tab.entityId === row.id)
    expect(terminal?.kind === 'terminal' ? terminal.terminal.botProfile : null).toEqual({ key: 'hermes:hermes@100.65.84.89:default', id: 'default', source: 'hermes', home: '/home/hermes', remotePath: '/home/hermes' })
  })
})
