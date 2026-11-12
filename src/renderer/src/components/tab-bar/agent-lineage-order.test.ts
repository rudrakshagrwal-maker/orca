import { describe, expect, it } from 'vitest'
import { agentLineageGroup, moveAgentLineageGroup, orderAgentLineage } from './agent-lineage-order'

// RA: behavior tests cover launch, restore, drag and re-parenting using the same ordering rule.
describe('agent tab groups', () => {
  const parents = new Map([
    ['child-1', 'parent'],
    ['grandchild', 'child-1'],
    ['child-2', 'parent']
  ])
  it('places new and restored children beside their own parent in sibling order', () => {
    expect(
      orderAgentLineage(['parent', 'other', 'child-1', 'child-2', 'grandchild'], parents)
    ).toEqual(['parent', 'child-1', 'grandchild', 'child-2', 'other'])
  })
  it('moves all descendants with the parent and snaps a detached child back', () => {
    const order = ['parent', 'child-1', 'grandchild', 'child-2', 'other']
    expect(moveAgentLineageGroup(order, 'parent', 5, parents)).toEqual([
      'other',
      'parent',
      'child-1',
      'grandchild',
      'child-2'
    ])
    expect(moveAgentLineageGroup(order, 'child-1', 5, parents)).toEqual([
      'parent',
      'child-2',
      'child-1',
      'grandchild',
      'other'
    ])
    expect([...agentLineageGroup('child-1', parents)]).toEqual(['child-1', 'grandchild'])
  })
  it('re-sorts re-parented tabs and tolerates missing parents and cycles', () => {
    expect(
      orderAgentLineage(['parent', 'child-1', 'other'], new Map([['child-1', 'other']]))
    ).toEqual(['parent', 'other', 'child-1'])
    expect(
      orderAgentLineage(
        ['a', 'b', 'c'],
        new Map([
          ['a', 'b'],
          ['b', 'a'],
          ['c', 'missing']
        ])
      )
    ).toEqual(['a', 'b', 'c'])
  })
})
