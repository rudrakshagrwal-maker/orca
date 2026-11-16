import { describe, expect, it, vi } from 'vitest'
import { reconcileManagedWslCliRegistrations } from './wsl-cli-registration-reconciliation'
import { runSerializedWslCliRegistrationOperation } from './wsl-cli-registration-operation'

describe('reconcileManagedWslCliRegistrations', () => {
  // RA: host-only startup must not spawn WSL or inspect host CLI installation state.
  it('does no discovery without owned WSL registrations or deployments', async () => {
    const listDistros = vi.fn(async () => ['Ubuntu'])
    const getHostLauncherTarget = vi.fn(async () => '/orca')
    expect(
      await reconcileManagedWslCliRegistrations({
        platform: 'win32',
        isPackaged: true,
        userDataPath: '/user-data',
        hasManagedRegistrations: async () => false,
        listOrcaHostDistros: () => [],
        listDistros,
        getHostLauncherTarget
      })
    ).toEqual([])
    expect(listDistros).not.toHaveBeenCalled()
    expect(getHostLauncherTarget).not.toHaveBeenCalled()
  })

  // RA: unavailable WSL must not fan out into additional installation probes.
  it('stops after an empty WSL list even when a managed launcher is recorded', async () => {
    const getHostLauncherTarget = vi.fn(async () => '/orca')
    expect(
      await reconcileManagedWslCliRegistrations({
        platform: 'win32',
        isPackaged: true,
        userDataPath: '/user-data',
        hasManagedRegistrations: async () => true,
        listOrcaHostDistros: () => [],
        listDistros: async () => [],
        getHostLauncherTarget
      })
    ).toEqual([])
    expect(getHostLauncherTarget).not.toHaveBeenCalled()
  })

  it('lets a Settings removal win over a late startup repair for the same distro', async () => {
    const events: string[] = []
    let repairStarted!: () => void
    let finishRepair!: () => void
    const started = new Promise<void>((resolve) => {
      repairStarted = resolve
    })
    const registry = {
      getCandidates: vi.fn(async () => ['Ubuntu']),
      recordObservations: vi.fn(async () => {
        events.push('repair-observed')
      })
    }
    const reconciliation = reconcileManagedWslCliRegistrations({
      platform: 'win32',
      isPackaged: true,
      userDataPath: '/user-data',
      // RA: this fixture represents an owned WSL launcher.
      hasManagedRegistrations: async () => true,
      listOrcaHostDistros: () => [],
      listDistros: async () => ['Ubuntu'],
      listRunningDistros: async () => ['Ubuntu'],
      isDistroRunning: async (distro: string) => ['Ubuntu'].includes(distro),
      registry,
      createInstaller: () => ({
        repairManagedRegistration: async () => {
          events.push('repair-started')
          repairStarted()
          await new Promise<void>((resolve) => {
            finishRepair = resolve
          })
          events.push('repair-finished')
          return {
            changed: true,
            managed: true,
            status: { state: 'installed' as const }
          }
        }
      })
    })
    await started

    const removal = runSerializedWslCliRegistrationOperation('ubuntu', async () => {
      events.push('settings-remove')
    })
    await Promise.resolve()
    expect(events).toEqual(['repair-started'])

    finishRepair()
    await Promise.all([reconciliation, removal])
    expect(events).toEqual([
      'repair-started',
      'repair-finished',
      'repair-observed',
      'settings-remove'
    ])
  })
})
