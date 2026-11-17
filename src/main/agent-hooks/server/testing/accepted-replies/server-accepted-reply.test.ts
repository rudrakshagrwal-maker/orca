// RA: Retain Claude and Codex while removing unused integrations and usage tracking.
import { readSavedStatus } from '../persistence/last-status.test-fixtures'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AgentHookServer, _internals } from '../../agent-hook-server'
import { buildBody, PANE } from '../server.test-fixtures'
import { mainAgentDoneAt } from '../../../../../shared/agent-status/lifecycle/main-agent-status'

vi.mock('../../../../telemetry/client', () => ({ track: vi.fn() }))
vi.mock('../../../../telemetry/cohort-classifier', () => ({
  getCohortAtEmit: () => ({ nth_repo_added: 2 })
}))

// Markers past the 8,000-char status preview prove the whole reply survived.
const REPLY = `START ${'a'.repeat(12_000)} MIDDLE-MARKER ${'b'.repeat(12_000)} END-MARKER`

let userDataPath: string
let server: AgentHookServer

beforeEach(async () => {
  _internals.resetCachesForTests()
  userDataPath = mkdtempSync(join(tmpdir(), 'orca-accepted-reply-'))
  server = new AgentHookServer()
  await server.start({ env: 'production', userDataPath })
})

afterEach(() => {
  server.stop()
  rmSync(userDataPath, { recursive: true, force: true })
})

async function post(payload: Record<string, unknown>): Promise<void> {
  const env = server.buildPtyEnv()
  await fetch(`http://127.0.0.1:${env.ORCA_AGENT_HOOK_PORT}/hook/claude`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Orca-Agent-Hook-Token': env.ORCA_AGENT_HOOK_TOKEN
    },
    body: JSON.stringify(buildBody(payload))
  })
}

/** What a run watcher reads: the reply for the lead turn its selected row reports finished. */
function replyForCurrentRow(): string | undefined {
  const row = server.getStatusSnapshotForPane(PANE)[0]
  const leadTurnKey = row ? mainAgentDoneAt(row) : undefined
  return leadTurnKey === undefined ? undefined : server.getAcceptedReply(PANE, leadTurnKey)
}

describe('accepted lead reply', () => {
  it('keeps the whole reply for its turn, out of saved and public status, until a new prompt', async () => {
    await post({ hook_event_name: 'UserPromptSubmit', prompt: 'write the report' })
    await post({ hook_event_name: 'Stop', last_assistant_message: REPLY })

    expect(replyForCurrentRow()).toBe(REPLY)
    server.flushStatusPersistSync()
    for (const published of [
      readSavedStatus(join(userDataPath, 'agent-hooks', 'last-status.json')),
      JSON.stringify(server.getStatusSnapshot())
    ]) {
      expect(published).not.toContain('MIDDLE-MARKER')
      expect(published).not.toContain('acceptedReply')
      expect(published).not.toContain('replyCandidate')
    }

    await post({ hook_event_name: 'UserPromptSubmit', prompt: 'next task' })
    await post({ hook_event_name: 'Stop' })
    expect(replyForCurrentRow()).toBeUndefined()
  })
})
