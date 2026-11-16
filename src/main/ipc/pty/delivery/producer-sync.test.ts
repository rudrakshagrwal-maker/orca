import { describe, expect, it, vi } from 'vitest'
import { PtyProducerFlowController } from './pty-producer-flow-control'
import { updateProducerFlowControl } from './producer-sync'
import { applyCumulativeAck } from './accounting'

vi.mock('../provider/registry', () => ({ tryGetProviderForPty: () => undefined }))

// RA: a renderer backlog must pause its producer even when main has no queued bytes.
describe('visible pane producer pressure', () => {
  it('pauses on unparsed bytes and resumes on parser credit without needing new output', () => {
    const commands: string[] = []
    const session = {
      pendingData: new Map(),
      rendererDeliveryAccountingByPty: new Map([
        [
          'pane',
          {
            sentChars: 300_000,
            ackedChars: 0,
            lastSendAtMs: 0,
            lastAckAtMs: null as number | null
          }
        ]
      ]),
      rendererInFlightTotalChars: 300_000,
      producerFlowControl: new PtyProducerFlowController({
        pauseProducer: (id) => commands.push(`pause:${id}`),
        resumeProducer: (id) => commands.push(`resume:${id}`)
      }),
      updateProducerFlowControl: (_id: string): void => {}
    }
    session.updateProducerFlowControl = (id) => updateProducerFlowControl(session as never, id)
    session.updateProducerFlowControl('pane')
    expect(commands).toEqual(['pause:pane'])
    applyCumulativeAck(session as never, 'pane', 300_000)
    expect(commands).toEqual(['pause:pane', 'resume:pane'])
    expect(session.rendererInFlightTotalChars).toBe(0)
  })
})
