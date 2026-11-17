import { expect, test } from './helpers/orca-app'
import {
  configureGoldenStubAgent,
  getGoldenStubAgentLaunchEnv,
  GOLDEN_STUB_EXIT_MARKER,
  launchGoldenStubAgentFromNewTab,
  newGoldenStubInputLogPath,
  readGoldenStubReceivedInput
} from './helpers/golden-stub-agent'
import { ensureTerminalVisible, waitForActiveWorktree, waitForSessionReady } from './helpers/store'
import {
  focusActiveTerminalInput,
  waitForActivePanePtyId,
  waitForTerminalOutput
} from './helpers/terminal'
import {
  clearTerminalPtyWriteLog,
  installTerminalPtyWriteSpy,
  readTerminalPtyWriteEntries
} from './helpers/terminal-pty-write-spy'

// RA: Grok is not selectable in this fork, so the stub runs as Codex.
const inputLog = newGoldenStubInputLogPath()
test.use({ launchEnv: getGoldenStubAgentLaunchEnv({ inputLog }) })
test.skip(process.platform !== 'win32', 'A real Windows ConPTY is required')

test('keeps standard keyboard bytes when a protocol-mode agent runs on ConPTY and after it exits', async ({
  electronApp,
  orcaPage
}) => {
  await installTerminalPtyWriteSpy(electronApp)
  await waitForSessionReady(orcaPage)
  await waitForActiveWorktree(orcaPage)
  await ensureTerminalVisible(orcaPage)
  // RA: Codex asks for the Kitty protocol (the stub sends CSI > 1 u). Orca withholds it on native
  // ConPTY, so the child must keep receiving standard bytes, never CSI-u.
  await configureGoldenStubAgent(orcaPage, {
    agent: 'codex',
    agentArgs: '--keyboard-protocol'
  })
  await launchGoldenStubAgentFromNewTab(orcaPage, /^Codex(?:\s|$)/i)

  const ptyId = await waitForActivePanePtyId(orcaPage)

  await clearTerminalPtyWriteLog(electronApp)
  await orcaPage.keyboard.press('Shift+Enter')
  await orcaPage.keyboard.type('exit')
  await orcaPage.keyboard.press('Enter')
  await waitForTerminalOutput(orcaPage, GOLDEN_STUB_EXIT_MARKER, 15_000)
  const protocolWrites = (await readTerminalPtyWriteEntries(electronApp))
    .filter((entry) => entry.id === ptyId)
    .map((entry) => entry.data)
    .join('')
  expect(protocolWrites).toContain('\r')
  const csiU = new RegExp(`${String.fromCharCode(27)}\\[\\d+(?:;\\d+)*u`)
  expect(protocolWrites).not.toMatch(csiU)
  // What the agent process itself received, not only what Orca wrote.
  expect(readGoldenStubReceivedInput(inputLog).join('')).not.toMatch(csiU)

  await clearTerminalPtyWriteLog(electronApp)
  await focusActiveTerminalInput(orcaPage)
  await orcaPage.keyboard.type("Write-Output ('CONPTY_KEYBOARD_' + '")
  await orcaPage.evaluate((text) => window.api.ui.writeClipboardText(text), 'REET_')
  await orcaPage.keyboard.press('Control+V')
  await orcaPage.keyboard.press('ArrowLeft')
  await orcaPage.keyboard.press('ArrowLeft')
  await orcaPage.keyboard.press('ArrowLeft')
  await orcaPage.keyboard.type('S')
  await orcaPage.keyboard.press('ArrowRight')
  await orcaPage.keyboard.press('ArrowRight')
  await orcaPage.keyboard.press('ArrowRight')
  await orcaPage.keyboard.type('EXECUTEX')
  await orcaPage.keyboard.press('Backspace')
  await orcaPage.keyboard.type("D')")
  await orcaPage.keyboard.press('Enter')
  await waitForTerminalOutput(orcaPage, 'CONPTY_KEYBOARD_RESET_EXECUTED', 15_000)

  const shellWrites = (await readTerminalPtyWriteEntries(electronApp))
    .filter((entry) => entry.id === ptyId)
    .map((entry) => entry.data)
  const joinedShellWrites = shellWrites.join('')
  expect(joinedShellWrites).toContain('REET_')
  expect(shellWrites.filter((data) => data === '\x1b[D')).toHaveLength(3)
  expect(shellWrites.filter((data) => data === '\x1b[C')).toHaveLength(3)
  expect(shellWrites).toContain('\x7f')
  expect(shellWrites).toContain('\r')
  expect(joinedShellWrites).not.toMatch(new RegExp(`${String.fromCharCode(27)}\\[\\d+(?:;\\d+)*u`))
})
