// RA: Verify admission thresholds and continuous recovery without sleeps or real process launches.
import { describe, expect, it } from 'vitest'
import { WorkerRamAdmission } from './worker-ram-admission'
describe('worker RAM admission', () => {
  it('queues above the limit and admits an immediate request at or below it', () => {
    const gate = new WorkerRamAdmission(() => 80)
    expect(gate.shouldQueue(83)).toBe(true)
    expect(gate.shouldQueue(80)).toBe(false)
    expect(gate.shouldQueue(74)).toBe(false)
    expect(gate.shouldQueue(Number.NaN)).toBe(true)
  })
  it('requires a continuous 30 seconds below the limit after queuing', () => {
    const gate = new WorkerRamAdmission(() => 80)
    expect(gate.ready(79, 1000)).toBe(false)
    expect(gate.ready(79, 30_999)).toBe(false)
    expect(gate.ready(79, 31_000)).toBe(true)
  })
  it('resets recovery when RAM reaches the line again', () => {
    const gate = new WorkerRamAdmission(() => 80)
    expect(gate.ready(79, 0)).toBe(false)
    expect(gate.ready(80, 29_000)).toBe(false)
    expect(gate.ready(78, 31_000)).toBe(false)
    expect(gate.ready(78, 60_999)).toBe(false)
    expect(gate.ready(78, 61_000)).toBe(true)
  })
  it('reads a changed owner limit and clamps it to the supported range', () => {
    let limit = 80
    const gate = new WorkerRamAdmission(() => limit)
    expect(gate.shouldQueue(83)).toBe(true)
    limit = 85
    expect(gate.shouldQueue(83)).toBe(false)
    limit = 99
    expect(gate.shouldQueue(91)).toBe(true)
    limit = 1
    expect(gate.shouldQueue(71)).toBe(true)
  })
})
