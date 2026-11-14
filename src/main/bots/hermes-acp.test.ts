import { afterEach, describe, expect, it } from 'vitest'
import { openAcpAdapterRig } from '../acp/session/testing/acp-structured-adapter.test-support'
import { HERMES_LAUNCH_SPEC } from '../acp/launch/acp-launch-registry'
import {
  closeProviderTimelineRigs,
  SESSION
} from '../native-chat/agent-session-timeline/provider-timeline-assembler-test-support'

afterEach(closeProviderTimelineRigs)
describe('Hermes native ACP chat', () => {
  it('loads the selected conversation and imports Hermes replay without message IDs', async () => {
    const rig = await openAcpAdapterRig({
      spec: HERMES_LAUNCH_SPEC,
      launch: {
        sessionCwd: '/home/hermes/.hermes/profiles/a2z',
        resume: {
          sessionId: 'saved-hermes-chat',
          key: 'saved-hermes-chat',
          mayBeUnsaved: () => false,
          unannouncedLosses: () => []
        }
      },
      script: (agent) => {
        agent.on('session/load', (frame) => {
          agent.notify('session/update', {
            sessionId: 'saved-hermes-chat',
            update: {
              sessionUpdate: 'user_message_chunk',
              content: { type: 'text', text: 'Earlier question' }
            }
          })
          agent.notify('session/update', {
            sessionId: 'saved-hermes-chat',
            update: {
              sessionUpdate: 'agent_message_chunk',
              content: { type: 'text', text: 'Earlier answer' }
            }
          })
          agent.reply(frame, {})
        })
      }
    })
    await rig.acquire()
    expect((await rig.frame('session/load')).params).toMatchObject({
      sessionId: 'saved-hermes-chat',
      cwd: '/home/hermes/.hermes/profiles/a2z'
    })
    const messages = (await rig.rig.rows())
      .filter((row) => row.body.kind === 'message')
      .map((row) => row.body)
    expect(messages).toMatchObject([
      { role: 'user', blocks: [{ type: 'text', text: 'Earlier question' }] },
      { role: 'assistant', blocks: [{ type: 'text', text: 'Earlier answer' }] }
    ])
  })
  it('starts a fresh chat and streams its reply through the native journal', async () => {
    const rig = await openAcpAdapterRig({
      spec: HERMES_LAUNCH_SPEC,
      script: (agent) => {
        agent.on('session/prompt', (frame) => {
          agent.notify('session/update', {
            sessionId: 'acp-session-1',
            update: {
              sessionUpdate: 'agent_message_chunk',
              content: { type: 'text', text: 'Hermes reply' }
            }
          })
          agent.reply(frame, { stopReason: 'end_turn' })
        })
      }
    })
    await rig.acquire()
    await rig.adapter.dispatch({
      sessionId: SESSION,
      clientMessageId: 'bot-message',
      fence: 1,
      body: { kind: 'message', role: 'user', blocks: [{ type: 'text', text: 'Hello' }] }
    })
    await rig.settle()
    expect((await rig.rig.rows()).map((row) => row.body)).toContainEqual(
      expect.objectContaining({
        kind: 'message',
        role: 'assistant',
        blocks: [{ type: 'text', text: 'Hermes reply' }]
      })
    )
  })
})
