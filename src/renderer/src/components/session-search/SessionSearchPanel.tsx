import { useEffect, useState } from 'react'
import { useAppStore } from '@/store'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useTranslate } from '@/i18n/use-translate'
import { LOCAL_EXECUTION_HOST_ID } from '../../../../shared/execution-host'
import { resolveAiVaultSearchSettings } from '../../../../shared/ai-vault/search/ai-vault-search-settings'
import type { AiVaultSearchHit } from '../../../../shared/ai-vault/search/ai-vault-search-types'
import { useSessionSearchStatus } from './use-session-search-status'
import { sessionSearchStatusMessage } from './session-search-status'
import { resumeSearchHit } from './resume-search-hit'

export default function SessionSearchPanel(): React.JSX.Element {
  const t = useTranslate()
  const [ready, setReady] = useState(false)
  const [activationError, setActivationError] = useState(false)
  useEffect(() => {
    let disposed = false
    void window.api.aiVault.activateSearch().then(
      () => {
        if (!disposed) {
          setReady(true)
        }
      },
      () => {
        if (!disposed) {
          setActivationError(true)
        }
      }
    )
    return () => {
      disposed = true
    }
  }, [])
  if (!ready) {
    return (
      <p role="status" className="px-2 py-2 text-xs text-muted-foreground">
        {activationError
          ? t('sidebar.search.failed', 'Could not start session search.')
          : t('sidebar.search.starting', 'Starting session search…')}
      </p>
    )
  }
  return <SessionSearchContents />
}

function SessionSearchContents(): React.JSX.Element {
  const t = useTranslate()
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<AiVaultSearchHit[]>([])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [opening, setOpening] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const settings = useAppStore((s) => s.settings)
  const updateSettings = useAppStore((s) => s.updateSettings)
  const hostScope = useAppStore((s) => s.workspaceHostScope)
  const { status, failed } = useSessionSearchStatus({
    executionHostId: hostScope === 'all' ? LOCAL_EXECUTION_HOST_ID : hostScope,
    active: true,
    refresh
  })
  const policy = resolveAiVaultSearchSettings(settings)

  useEffect(() => {
    let disposed = false
    setHits([])
    setMessage('')
    setLoading(false)
    if (!query.trim()) {
      return
    }
    const timer = setTimeout(() => {
      setLoading(true)
      void window.api.aiVault
        .searchSessions(
          {
            query,
            limit: 50,
            filters: { agents: ['claude', 'codex'] }
          },
          hostScope
        )
        .then(
          (result) => {
            if (disposed) {
              return
            }
            if (result.kind === 'results') {
              setHits(result.hits)
              setMessage(
                result.hits.length === 0
                  ? t('sidebar.search.empty', 'No matching chats.')
                  : result.page.hasMore
                    ? t(
                        'sidebar.search.more',
                        'Showing the first 50 matches. Refine your search for more.'
                      )
                    : ''
              )
            } else {
              setMessage(
                t(
                  'sidebar.search.unavailable',
                  'Search is not ready. Check indexing status and try again.'
                )
              )
            }
          },
          () => {
            if (!disposed) {
              setMessage(t('sidebar.search.queryFailed', 'Could not search chats.'))
            }
          }
        )
        .finally(() => {
          if (!disposed) {
            setLoading(false)
          }
        })
    }, 250)
    return () => {
      disposed = true
      clearTimeout(timer)
    }
  }, [query, hostScope, status?.generation, status?.filesIndexed, refresh, t])

  async function enable(): Promise<void> {
    setLoading(true)
    try {
      await updateSettings({ aiVaultSearch: { ...policy, enabled: true } })
      setRefresh((value) => value + 1)
    } catch {
      setMessage(t('sidebar.search.enableFailed', 'Could not enable session search.'))
    } finally {
      setLoading(false)
    }
  }

  async function open(hit: AiVaultSearchHit): Promise<void> {
    setOpening(true)
    try {
      await resumeSearchHit(hit)
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : t('sidebar.search.resumeFailed', 'Could not resume this chat.')
      )
    } finally {
      setOpening(false)
    }
  }

  return (
    <section
      aria-label={t('sidebar.search.chats', 'Search agent chats')}
      className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden px-2 pb-2"
    >
      <Input
        aria-label={t('sidebar.search.query', 'Search Claude and Codex chats')}
        placeholder={t('sidebar.search.placeholder', 'Search chats…')}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <div role="status" className="text-xs text-muted-foreground">
        {failed
          ? t('sidebar.search.statusFailed', 'Could not read indexing status.')
          : status
            ? sessionSearchStatusMessage(status, t)
            : t('sidebar.search.checking', 'Checking index…')}
      </div>
      {!policy.enabled ? (
        <Button variant="secondary" size="sm" disabled={loading} onClick={() => void enable()}>
          {t('sidebar.search.enable', 'Enable session search')}
        </Button>
      ) : null}
      {loading ? (
        <p role="status" className="text-xs text-muted-foreground">
          {t('sidebar.search.searching', 'Searching…')}
        </p>
      ) : null}
      {message ? (
        <p role="status" className="text-xs text-muted-foreground">
          {message}
        </p>
      ) : null}
      <div className="min-h-0 flex-1 overflow-y-auto worktree-sidebar-scrollbar">
        {hits.map((hit) => (
          <button
            key={`${hit.executionHostId}:${hit.agent}:${hit.sessionId}`}
            type="button"
            disabled={opening || hit.source.presence !== 'present'}
            onClick={() => void open(hit)}
            className="flex w-full flex-col gap-1 rounded-md px-2 py-2 text-left hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            <span className="w-full truncate text-sm">{hit.title || hit.sessionId}</span>
            <span className="text-2xs text-muted-foreground">
              {hit.agent === 'claude' ? 'Claude' : 'Codex'}
            </span>
            {hit.evidence ? (
              <span className="line-clamp-3 text-xs text-muted-foreground">
                {hit.evidence.snippet}
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </section>
  )
}
