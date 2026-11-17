import { agentSessionConversationView } from '../../../../shared/agent-session/lifecycle/agent-session-conversation-view'
import { afterEach, expect, it, vi } from 'vitest'
import { agentSessionRecordFixture } from '../../../../shared/agent-session/lifecycle/agent-session-record.test-fixture'
import { agentModelCatalogStore } from '../../../native-chat/agent-model-catalog/agent-model-catalog-store'
import { agentModelCatalogFingerprintForRecord } from '../../../native-chat/agent-model-catalog/agent-model-catalog-fingerprint'
import { createAgentModelCatalogService } from '../../../native-chat/agent-model-catalog/agent-model-catalog-service'
import {
  captureHostShellEnvironment,
  createStructuredAgentEnvironmentResolvers
} from './structured-agent-shell-environment'

const shell = vi.hoisted(
  (): {
    current: { PATH: string; IGNORED: string }
    next: { PATH: string; IGNORED: string }
    saved: string[]
    nextSaved: string[]
  } => ({
    current: { PATH: '/a', IGNORED: 'a' },
    next: { PATH: '/a', IGNORED: 'a' },
    saved: [],
    nextSaved: []
  })
)
vi.mock('../../../startup/login-shell-environment', () => ({
  resolveLoginShellEnvironment: async (options?: { startedAfter?: number }) => {
    if (options?.startedAfter !== undefined) {
      shell.current = { ...shell.next }
    }
    return { ...shell.current }
  }
}))
vi.mock('../../../pty/environment/windows-environment-path', () => ({
  cachedPersistedWindowsPathSegments: () => shell.saved,
  readPersistedWindowsPathSegmentsAsync: async () => (shell.saved = [...shell.nextSaved]),
  mergePersistedWindowsPathAsync: async () => {}
}))

const cleanups: (() => void)[] = []
afterEach(() => {
  cleanups.splice(0).forEach((stop) => stop())
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  shell.current = { PATH: '/a', IGNORED: 'a' }
  shell.next = { ...shell.current }
  shell.saved = []
  shell.nextSaved = []
})

function rig(overlay?: Record<string, string>) {
  const record = {
    ...agentSessionRecordFixture(),
    provider: 'grok',
    accountHome: { variable: 'GROK_HOME', path: '/catalog-refresh-fixture' }
  }
  const save = vi.fn()
  const defaults = vi.fn(async () => false)
  const service = createAgentModelCatalogService({
    store: agentModelCatalogStore,
    getConversation: (id) => {
      const held = id === record.sessionId ? record : undefined
      return held ? agentSessionConversationView(held) : undefined
    },
    getRecord: (id) => (id === record.sessionId ? record : undefined),
    drivesRecord: () => true,
    resolveAccountHome: async () => record.accountHome,
    recordWorkspacePath: async () => '/workspace',
    workspaceMayOverrideDefaultModel: defaults
  })
  const environment = createStructuredAgentEnvironmentResolvers({
    resolveShellEnvironmentPolicy: () => ({ inheritAll: false, names: [] }),
    resolveAgentLaunchEnv: () => overlay ?? {}
  })
  cleanups.push(service.stop, environment.bindCatalogSources(['grok']))
  const listing = (id: string) => ({
    models: [{ id, label: id, isDefault: true, efforts: [] }],
    configuredDefault: { modelId: id, effort: 'high' }
  })
  return {
    record,
    service,
    save,
    defaults,
    listing,
    fingerprint: agentModelCatalogFingerprintForRecord(record)
  }
}

it('keeps a Windows catalog source while only a shadowed inherited path changes', async () => {
  vi.stubGlobal('process', { ...process, platform: 'win32' })
  const overlay = { path: '/configured/bin' }
  const h = rig(overlay)
  const source = h.service.captureSource(h.record)
  cleanups.push(() => source.release?.())
  await captureHostShellEnvironment(async () => {
    shell.next = { PATH: '/changed', IGNORED: 'a' }
  })
  expect(source()).toBe(true)
  await captureHostShellEnvironment(async () => {
    overlay.path = '/new-configured/bin'
  })
  expect(source()).toBe(false)
})

