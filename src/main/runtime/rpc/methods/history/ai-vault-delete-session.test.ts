import { mkdirSync, mkdtempSync, rmSync, writeFileSync, existsSync, realpathSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type * as NodeOs from 'node:os'
import { afterAll, describe, expect, it, vi } from 'vitest'

const home = vi.hoisted(() => ({ dir: '' }))
vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof NodeOs>()
  return { ...actual, homedir: () => home.dir }
})

home.dir = realpathSync(mkdtempSync(join(tmpdir(), 'orca-ai-vault-host-delete-')))

const { RpcDispatcher } = await import('../../dispatcher')
const { AI_VAULT_METHODS } = await import('./ai-vault')
const { RuntimeAiVaultCommands } =
  await import('../../../integrations/ai-vault/runtime-ai-vault-commands')

function dispatcher(): InstanceType<typeof RpcDispatcher> {
  const vault = new RuntimeAiVaultCommands(() => null)
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the delete handler reads only this member.
  const runtime = {
    getRuntimeId: () => 'test-runtime',
    deleteAiVaultSession: vault.delete.bind(vault)
  } as unknown as ConstructorParameters<typeof RpcDispatcher>[0]['runtime']
  return new RpcDispatcher({ runtime, methods: AI_VAULT_METHODS })
}

function writeSession(name: string): string {
  const dir = join(home.dir, '.gemini', 'tmp', 'project-a')
  mkdirSync(dir, { recursive: true })
  const filePath = join(dir, name)
  writeFileSync(filePath, '{}')
  return filePath
}

afterAll(() => {
  rmSync(home.dir, { recursive: true, force: true })
})

describe('aiVault.deleteSession', () => {

})
