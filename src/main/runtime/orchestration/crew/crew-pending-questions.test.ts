import { expect, it } from 'vitest'
import { fixture } from './crew-read-model.test-fixture'
import { buildCrewSnapshot } from './crew-party-snapshot'

it('keeps a helper question with its immediate parent after that parent settles', () => {
  const { db, deps, run, assign } = fixture()
  const parent = assign('term_worker')
  const helper = assign('term_helper', 'term_worker')
  const question = db.createQuestion({
    runId: run.id,
    dispatchId: helper.id,
    askerHandle: 'term_helper',
    to: `dispatch:${parent.id}`,
    question: 'Choose the helper option?'
  })
  db.completeDispatch(parent.id)
  expect(db.getMessageById(question.message.id)?.to_handle).toBe(`dispatch:${parent.id}`)
  const snapshot = buildCrewSnapshot('term_worker', deps)
  expect(snapshot.sections.managing.find((row) => row.sendAddress === `dispatch:${helper.id}`)?.pendingQuestion?.preview).toBe('Choose the helper option?')
  expect(db.getQuestion(question.message.id)?.status).toBe('pending')
})
