import { expect, it } from 'vitest'
import { evaluateAgentStateRules } from './agent-state-rules-engine'

it('waits for the Hermes composer after startup and recognizes its ready screen', () => {
  expect(
    evaluateAgentStateRules('hermes', {
      readScreenLines: () => [
        '─ starting agent… │ model │ 0s │ voice off',
        '❯ Try "/help" for commands'
      ]
    })
  ).toMatchObject({ state: 'hold' })

  expect(
    evaluateAgentStateRules('hermes', {
      readScreenLines: () => ['─ ready │ model │ 0s │ voice off', '❯ Try "/help" for commands']
    })
  ).toMatchObject({ state: 'idle', strength: 'strong' })
})
