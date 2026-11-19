import { expect, it, vi } from 'vitest'
import { openDetectedFilePath } from './files/terminal-file-open-routing'
import { createTerminalLinkTestDoubles } from './terminal-link-handlers-test-fixtures'
import {
  flushAsyncWork,
  installTerminalLinkTestEnvironment,
  setPlatform
} from './terminal-link-handlers-test-harness'

const doubles = createTerminalLinkTestDoubles()
vi.mock('@/store/index', () => ({ useAppStore: { getState: () => doubles.storeState } }))
vi.mock('@/lib/workspace/activation/worktree-activation', () => ({
  activateAndRevealWorkspace: vi.fn(),
  activateAndRevealWorktree: vi.fn()
}))
vi.mock('@/lib/workspace/ownership/connection-context', () => ({
  getConnectionId: vi.fn(() => null)
}))
installTerminalLinkTestEnvironment(doubles)

it.each(['note.txt', 'photo.png', 'guide.pdf', 'clip.mp4', 'track.mp3'])(
  'opens %s inside Orca, including files outside the workspace',
  async (name) => {
    setPlatform('Windows')
    const externalEditor = vi.fn()
    window.api.shell.openInExternalEditor = externalEditor
    openDetectedFilePath(`C:\\Users\\Owner\\Downloads\\${name}`, null, null, {
      worktreeId: 'wt-1',
      worktreePath: 'C:\\repo'
    })
    await flushAsyncWork()
    expect(doubles.openFileMock).toHaveBeenCalledWith(
      expect.objectContaining({
        filePath: `C:\\Users\\Owner\\Downloads\\${name}`,
        mode: 'edit'
      }),
      expect.anything()
    )
    expect(doubles.openFilePathMock).not.toHaveBeenCalled()
    expect(externalEditor).not.toHaveBeenCalled()
  }
)

it.each(['archive.zip', 'sheet.xlsx', 'program.exe'])(
  'uses the OS association for unsupported %s',
  async (name) => {
    setPlatform('Windows')
    const externalEditor = vi.fn()
    window.api.shell.openInExternalEditor = externalEditor
    openDetectedFilePath(`C:\\Users\\Owner\\Downloads\\${name}`, null, null, {
      worktreeId: 'wt-1',
      worktreePath: 'C:\\repo'
    })
    await flushAsyncWork()
    expect(doubles.openFilePathMock).toHaveBeenCalledWith(
      `C:\\Users\\Owner\\Downloads\\${name}`,
      'local'
    )
    expect(doubles.openFileMock).not.toHaveBeenCalled()
    expect(externalEditor).not.toHaveBeenCalled()
  }
)

it('reports a failed OS association instead of opening unsupported bytes as text', async () => {
  setPlatform('Windows')
  doubles.openFilePathMock.mockResolvedValueOnce(false)
  const onOpenFailure = vi.fn()
  openDetectedFilePath('C:\\Downloads\\archive.zip', null, null, {
    worktreeId: 'wt-1',
    worktreePath: 'C:\\repo',
    onOpenFailure
  })
  await flushAsyncWork()
  expect(onOpenFailure).toHaveBeenCalledWith({ verdict: 'unavailable' })
  expect(doubles.openFileMock).not.toHaveBeenCalled()
})
