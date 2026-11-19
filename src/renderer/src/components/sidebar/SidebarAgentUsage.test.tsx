// @vitest-environment happy-dom
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { ProviderRateLimits } from '../../../../shared/rate-limit-types'
import { SidebarAgentUsageRows } from './SidebarAgentUsage'

afterEach(cleanup)

it('shows separate session and weekly meters and their reset times in one row per agent', () => {
  const reset = new Date(2026, 10, 19, 15, 30).getTime()
  const provider: ProviderRateLimits = {
    provider: 'claude',
    status: 'ok',
    updatedAt: 1,
    error: null,
    session: { usedPercent: 24, windowMinutes: 300, resetsAt: reset, resetDescription: null },
    weekly: { usedPercent: 61, windowMinutes: 10080, resetsAt: null, resetDescription: 'Fri' }
  }
  const onOpenProvider = vi.fn()
  const view = render(
    <SidebarAgentUsageRows
      providers={[provider, { ...provider, provider: 'codex' }]}
      onOpenProvider={onOpenProvider}
    />
  )
  expect(view.getAllByRole('button')).toHaveLength(2)
  expect(view.getAllByRole('meter', { name: '5h' })[0].getAttribute('aria-valuenow')).toBe('24')
  expect(view.getAllByRole('meter', { name: '7d' })[0].getAttribute('aria-valuenow')).toBe('61')
  expect(view.getAllByText('15:30')).toHaveLength(2)
  expect(view.getAllByText('Fri')).toHaveLength(2)
  fireEvent.click(view.getByRole('button', { name: 'codex: ok' }))
  expect(onOpenProvider).toHaveBeenCalledWith('codex')
})

it('does not invent usage when limits are unavailable', () => {
  const view = render(
    <SidebarAgentUsageRows
      providers={[
        {
          provider: 'codex',
          status: 'error',
          error: 'Unavailable',
          updatedAt: 0,
          session: null,
          weekly: null
        }
      ]}
      onOpenProvider={vi.fn()}
    />
  )
  expect(view.getByRole('button', { name: 'codex: Unavailable' })).toBeDefined()
  expect(view.getAllByRole('meter').every((meter) => !meter.hasAttribute('aria-valuenow'))).toBe(
    true
  )
})
