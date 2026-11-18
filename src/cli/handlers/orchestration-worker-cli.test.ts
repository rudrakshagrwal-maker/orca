import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const callMock = vi.fn()
const originalExitCode = process.exitCode
vi.mock('../format', async (importOriginal) => {
  const original = await importOriginal<{ printResult: typeof printResult }>()
  return { printResult: vi.fn(original.printResult) }
})
vi.mock('../selectors', () => ({ getTerminalHandle: vi.fn() }))

import { ORCHESTRATION_HANDLERS } from './orchestration'
import { printResult } from '../format'

import { RuntimeClient } from '../runtime-client'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseArgs, validateCommandAndFlags } from '../args'
import { COMMAND_SPECS } from '../specs'

const client = new RuntimeClient('/tmp/orca-worker-cli', 60_000, null, null)

describe('orchestration worker-start CLI contract', () => {
  beforeEach(() => {
    callMock.mockReset()
    vi.spyOn(client, 'call').mockImplementation(callMock)
    vi.mocked(printResult).mockClear()
    vi.spyOn(console, 'log').mockImplementation(() => {})
    process.exitCode = undefined
    vi.stubEnv('ORCA_CLI_COMMAND', undefined)
    vi.stubEnv('ORCA_DEV_CLI_INVOCATION', undefined)
    vi.stubEnv('ORCA_USER_DATA_PATH', undefined)
    vi.stubEnv('ORCA_TERMINAL_HANDLE', 'term_coord')
    vi.stubEnv('ORCA_AGENT_SESSION_ID', undefined)
  })

  afterEach(() => {
    process.exitCode = originalExitCode
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  const invokeWorkerStart = (flags: Map<string, string | boolean>, json = true) =>
    ORCHESTRATION_HANDLERS['orchestration worker-start']({
      flags,
      client,
      cwd: '/tmp/repo',
      json
    })

  it('sets an unsuccessful exit code for an unknown receipt', async () => {
    callMock.mockResolvedValue({
      result: {
        taskId: 'task_1',
        dispatchId: 'ctx_1',
        state: 'outcome_unknown',
        effects: [],
        residualResources: []
      }
    })

    await invokeWorkerStart(
      new Map<string, string | boolean>([
        ['task', 'task_1'],
        ['agent', 'codex'],
        ['from', 'term_coord']
      ])
    )

    expect(process.exitCode).toBe(1)
  })

  it.each(['codex', 'claude', 'hermes', 'dsh'])(
    'starts %s from a brief and prints only the final report',
    async (agent) => {
      const directory = await mkdtemp(join(tmpdir(), 'orca-brief-'))
      try {
        await writeFile(
          join(directory, 'brief.md'),
          'Inspect the parser. Preserve `$quotes` and newlines.\nReport findings.'
        )
        callMock.mockImplementation(async (method) => {
          if (method === 'orchestration.workerStart') {
            return {
              result: {
                runId: 'r1',
                taskId: 't1',
                dispatchId: 'd1',
                state: 'ready',
                effects: [],
                residualResources: []
              }
            }
          }
          if (method === 'orchestration.workerShow') {
            return {
              ok: true,
              result: {
                dispatchId: 'd1',
                state: 'succeeded',
                outcome: 'succeeded',
                result: 'Parser is correct.',
                timedOut: false,
                cancelled: false
              }
            }
          }
          throw new Error(`Unexpected method ${method}`)
        })
        const parsed = parseArgs([
          'orchestration',
          'worker-start',
          '--agent',
          agent,
          '--brief-file',
          join(directory, 'brief.md'),
          '--wait',
          '--timeout',
          '45',
          '--json'
        ])
        validateCommandAndFlags(COMMAND_SPECS, parsed)
        await invokeWorkerStart(new Map([...parsed.flags, ['from', 'term_coord']]))
        expect(callMock).toHaveBeenCalledWith(
          'orchestration.workerStart',
          expect.objectContaining({
            agent,
            spec: 'Inspect the parser. Preserve `$quotes` and newlines.\nReport findings.'
          })
        )
        expect(callMock).toHaveBeenCalledWith(
          'orchestration.workerShow',
          { dispatch: 'd1', wait: true, timeoutMs: 45_000 },
          { timeoutMs: 55_000 }
        )
        expect(console.log).toHaveBeenCalledOnce()
        expect(JSON.parse(vi.mocked(console.log).mock.calls[0][0])).toMatchObject({
          result: { dispatchId: 'd1', result: 'Parser is correct.' }
        })
        expect(process.exitCode).toBeUndefined()
      } finally {
        await rm(directory, { recursive: true, force: true })
      }
    }
  )

  const invalidFlags: [string, string | boolean][][] = [
    [['timeout', '3']],
    [
      ['wait', true],
      ['timeout', '0']
    ],
    [
      ['wait', true],
      ['timeout', '2147484']
    ],
    [
      ['brief-file', 'brief.md'],
      ['spec', 'other']
    ]
  ]
  it.each(invalidFlags.map((entries) => ({ flags: new Map(entries) })))(
    'rejects invalid brief/wait flags before launching',
    async ({ flags }) => {
      await expect(invokeWorkerStart(flags)).rejects.toMatchObject({ code: 'invalid_argument' })
      expect(callMock).not.toHaveBeenCalled()
    }
  )

  it.each([
    {
      outcome: 'failed',
      state: 'failed',
      result: 'Build failed.',
      timedOut: false,
      cancelled: false
    },
    { outcome: null, state: 'ready', result: null, timedOut: true, cancelled: false }
  ])('returns nonzero with recoverable IDs when waiting ends unsuccessfully', async (ending) => {
    callMock
      .mockResolvedValueOnce({
        result: {
          runId: 'r1',
          taskId: 't1',
          dispatchId: 'd1',
          state: 'ready',
          effects: [],
          residualResources: []
        }
      })
      .mockResolvedValueOnce({ result: { runId: 'r1', taskId: 't1', dispatchId: 'd1', ...ending } })
    await invokeWorkerStart(
      new Map<string, string | boolean>([
        ['agent', 'codex'],
        ['spec', 'brief'],
        ['from', 'term_coord'],
        ['wait', true]
      ])
    )
    expect(process.exitCode).toBe(1)
    expect(JSON.parse(vi.mocked(console.log).mock.calls[0][0])).toMatchObject({
      result: { runId: 'r1', taskId: 't1', dispatchId: 'd1', ...ending }
    })
  })

  it.each(['coordinator-start', 'coordinator-stop', 'run', 'run-stop', 'worker-retain'])(
    'rejects removed command %s before runtime access',
    (command) => {
      expect(() =>
        validateCommandAndFlags(COMMAND_SPECS, parseArgs(['orchestration', command]))
      ).toThrow('Unknown command')
    }
  )

  it.each([false, true])(
    'lists live workers by default and exposes history with --all=%s',
    async (all) => {
      callMock.mockResolvedValue({
        result: { workers: [], counts: {}, page: { total: 0, hasMore: false, nextCursor: null } }
      })
      const flags = new Map<string, string | boolean>([['run', 'r1']])
      if (all) {
        flags.set('all', true)
      }
      await ORCHESTRATION_HANDLERS['orchestration worker-list']({
        flags,
        client,
        cwd: '/tmp/repo',
        json: true
      })
      expect(callMock).toHaveBeenCalledWith(
        'orchestration.workerList',
        expect.objectContaining({ run: 'r1', liveOnly: !all })
      )
    }
  )

  it('can resume a result wait without starting a second worker', async () => {
    callMock.mockResolvedValue({
      result: {
        dispatchId: 'd1',
        state: 'succeeded',
        outcome: 'succeeded',
        result: 'Saved result',
        timedOut: false,
        cancelled: false
      }
    })
    await ORCHESTRATION_HANDLERS['orchestration worker-show']({
      flags: new Map<string, string | boolean>([
        ['dispatch', 'd1'],
        ['wait', true],
        ['timeout', '12']
      ]),
      client,
      cwd: '/tmp/repo',
      json: true
    })
    expect(callMock).toHaveBeenCalledWith(
      'orchestration.workerShow',
      { dispatch: 'd1', wait: true, timeoutMs: 12_000 },
      { timeoutMs: 22_000 }
    )
    expect(JSON.parse(vi.mocked(console.log).mock.calls[0][0])).toMatchObject({
      result: { result: 'Saved result' }
    })
  })
})
