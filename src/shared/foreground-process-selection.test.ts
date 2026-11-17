import { describe, expect, it } from 'vitest'
import {
  selectForegroundProcessCandidate,
  type ForegroundProcessCandidate
} from './foreground-process-selection'

describe('selectForegroundProcessCandidate', () => {


})

it('terminates on a ppid cycle that never reaches the outer agent', () => {
  const cycle: ForegroundProcessCandidate[] = [
    { pid: 1, ppid: 0, depth: 0, stat: 'S+', command: 'claude' },
    { pid: 2, ppid: 3, depth: 1, stat: 'S+', command: 'codex' },
    { pid: 3, ppid: 2, depth: 2, stat: 'S+', command: 'bash -lc build' }
  ]
  expect(selectForegroundProcessCandidate(cycle)).toBeNull()
})

