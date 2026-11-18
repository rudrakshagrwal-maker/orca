import { afterEach, expect, it, vi } from 'vitest'
import type { WebContents } from 'electron'

vi.mock('electron', () => ({ app: { getPath: () => '/test-profile' } }))
vi.mock('../browser/browser', () => ({
  registerBrowserHandlers: vi.fn(),
  setAgentBrowserBridgeRef: vi.fn()
}))
vi.mock('../app', () => ({ registerAppHandlers: vi.fn() }))
vi.mock('../wsl/wsl-move-driver-wiring', () => ({ registerWslMoveWiring: vi.fn() }))
vi.mock('../wsl/wsl-drive-project-handlers', () => ({ registerWslDriveProjectHandlers: vi.fn() }))
vi.mock('../../workspaces/execution-host/project-runtime-git-router', () => ({
  installProjectRuntimeGitRouter: vi.fn()
}))
vi.mock('../cli', () => ({ registerCliHandlers: vi.fn() }))
vi.mock('../preflight', () => ({ registerPreflightHandlers: vi.fn() }))
vi.mock('../filesystem/filesystem', () => ({ registerFilesystemHandlers: vi.fn() }))
vi.mock('../filesystem/watchers/filesystem-watcher-handlers', () => ({
  registerFilesystemWatcherHandlers: vi.fn()
}))
vi.mock('../feedback', () => ({ registerFeedbackHandlers: vi.fn() }))
vi.mock('../crash-reporting/crash-reporting', () => ({ registerCrashReportingHandlers: vi.fn() }))
vi.mock('../export', () => ({ registerExportHandlers: vi.fn() }))
vi.mock('../stats', () => ({ registerStatsHandlers: vi.fn() }))
vi.mock('../runtime', () => ({ registerRuntimeHandlers: vi.fn() }))
vi.mock('../runtime-environments/runtime-environments', () => ({
  invalidateRuntimeEnvironmentTransport: vi.fn(),
  registerRuntimeEnvironmentHandlers: vi.fn()
}))
vi.mock('../wsl/wsl-host-handlers', () => ({ registerWslHostHandlers: vi.fn() }))
vi.mock('../ai-vault/ai-vault', () => ({ registerAiVaultHandlers: vi.fn() }))
vi.mock('../terminal-preview', () => ({ registerTerminalPreviewHandlers: vi.fn() }))
vi.mock('../developer-permissions', () => ({ registerDeveloperPermissionHandlers: vi.fn() }))
vi.mock('../session', () => ({ registerSessionHandlers: vi.fn() }))
vi.mock('../settings', () => ({ registerSettingsHandlers: vi.fn() }))
vi.mock('../diagnostics', () => ({ registerDiagnosticsHandlers: vi.fn() }))
vi.mock('../keybindings', () => ({ registerKeybindingHandlers: vi.fn() }))
vi.mock('../telemetry', () => ({ registerTelemetryHandlers: vi.fn() }))
vi.mock('../shell', () => ({ registerShellHandlers: vi.fn() }))
vi.mock('../ui', () => ({
  registerUIHandlers: vi.fn(),
  setTrustedUIRendererWebContentsId: vi.fn()
}))
vi.mock('../terminal-render-desync-evidence', () => ({
  registerTerminalRenderDesyncEvidenceHandler: vi.fn()
}))
vi.mock('../profiles/orca-profiles', () => ({ registerOrcaProfileHandlers: vi.fn() }))
vi.mock('../codex-accounts', () => ({ registerCodexAccountHandlers: vi.fn() }))
vi.mock('../agent-hooks', () => ({ registerAgentHookHandlers: vi.fn() }))
vi.mock('../codex-config-sync', () => ({ registerCodexConfigSyncHandlers: vi.fn() }))
vi.mock('../pty/pane/key-state', () => ({ getPtyIdForPaneKey: vi.fn() }))
vi.mock('../claude-accounts', () => ({ registerClaudeAccountHandlers: vi.fn() }))
vi.mock('../../window/attach-main-window-services', () => ({ registerUpdaterHandlers: vi.fn() }))
vi.mock('../../window/clipboard-ipc-handlers', () => ({
  registerClipboardHandlers: vi.fn(),
  setTrustedClipboardRendererWebContentsId: vi.fn()
}))
vi.mock('../../ai-vault/runtime-session-scanner', () => ({
  getSavedRuntimeAiVaultHostInfos: vi.fn(),
  deleteRuntimeAiVaultSession: vi.fn(),
  prepareRuntimeAiVaultSessionResume: vi.fn(),
  resolveRuntimeAiVaultSessionTitles: vi.fn(),
  scanRuntimeAiVaultSessions: vi.fn()
}))
vi.mock('../ai-vault/ai-vault-delete', () => ({ configureRuntimeAiVaultSessionDelete: vi.fn() }))
vi.mock('../../runtime/agent-session/structured-agent-session-host-refusal', () => ({
  ensureStructuredAgentSessionHostUnlessRefused: vi.fn()
}))
vi.mock('../runtime-environments/runtime-environment-registry-root', () => ({
  getRuntimeEnvironmentRegistryRoot: vi.fn()
}))

import { registerCoreHandlers } from './register-core-handlers'
import {
  isTrustedBrowserRenderer,
  setTrustedBrowserRendererWebContentsId
} from '../browser/browser-renderer-trust'

afterEach(() => {
  setTrustedBrowserRendererWebContentsId(null)
  vi.unstubAllEnvs()
})

it('trusts only the current packaged main renderer, including after window recreation', () => {
  vi.stubEnv('ELECTRON_RENDERER_URL', undefined)
  setTrustedBrowserRendererWebContentsId(null)
  const registerForRenderer = (id: number): void => {
    type Args = Parameters<typeof registerCoreHandlers>
    registerCoreHandlers(
      {} as Args[0],
      { getAgentBrowserBridge: () => null } as unknown as Args[1],
      {} as Args[2],
      {} as Args[3],
      {} as Args[4],
      id
    )
  }
  const sender = (id: number, type = 'window'): WebContents =>
    ({
      id,
      isDestroyed: () => false,
      getType: () => type,
      getURL: () => 'file:///orca/renderer/index.html'
    }) as WebContents

  expect(isTrustedBrowserRenderer(sender(91))).toBe(false)
  registerForRenderer(91)
  expect(isTrustedBrowserRenderer(sender(91))).toBe(true)
  expect(isTrustedBrowserRenderer(sender(92))).toBe(false)
  expect(isTrustedBrowserRenderer(sender(91, 'webview'))).toBe(false)

  registerForRenderer(92)
  expect(isTrustedBrowserRenderer(sender(92))).toBe(true)
  expect(isTrustedBrowserRenderer(sender(91))).toBe(false)
})
