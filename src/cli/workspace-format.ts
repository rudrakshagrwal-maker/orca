import { formatAddressLines, formatParentLine, type WorkspaceAnnotation } from './workspace-address'
import type { PublicKnownRuntimeEnvironment } from '../shared/remote-runtime/host-catalog/runtime-environments'
import type {
  RuntimeRepoList,
  RuntimeRepoSearchRefs,
  RuntimeWorktreeListResult,
  RuntimeWorktreePsResult,
  RuntimeWorktreeRecord
} from '../shared/runtime-types'
import { formatListingHostScope, type WithAnnotatedHostScope } from './omitted-host-scope-selectors'
import { formatWorktreePsTerminalFields } from './worktree-ps-terminal-verdict'
import { formatWorktreePsProgramStatus } from './worktree-ps-program-status'

export function formatEnvironmentList(result: {
  environments: PublicKnownRuntimeEnvironment[]
}): string {
  if (result.environments.length === 0) {
    return 'No saved environments.'
  }
  return result.environments
    .map(
      (environment) =>
        `${environment.id}  ${environment.name}  ${environment.endpoints[0]?.endpoint ?? 'no-endpoint'}`
    )
    .join('\n')
}

export function formatEnvironment(environment: PublicKnownRuntimeEnvironment): string {
  return [
    `id: ${environment.id}`,
    `name: ${environment.name}`,
    `runtimeId: ${environment.runtimeId ?? 'unknown'}`,
    `lastUsedAt: ${environment.lastUsedAt ?? 'never'}`,
    `preferredEndpointId: ${environment.preferredEndpointId}`,
    ...environment.endpoints.map(
      (endpoint) => `endpoint: ${endpoint.id} ${endpoint.kind} ${endpoint.endpoint}`
    )
  ].join('\n')
}

type AnnotatedPsRow = RuntimeWorktreePsResult['worktrees'][number] & Partial<WorkspaceAnnotation>

export function formatWorktreePs(
  result: WithAnnotatedHostScope<
    Omit<RuntimeWorktreePsResult, 'worktrees'> & { worktrees: AnnotatedPsRow[] }
  >
): string {
  const scope = formatListingHostScope(result.hostScope)
  if (result.worktrees.length === 0) {
    return `No worktrees found.\n${scope}`
  }
  const body = result.worktrees
    .map(
      (worktree) =>
        `${worktree.repo} ${worktree.branch}  host=${worktree.hostId ?? 'unverifiable'}  ${formatWorktreePsTerminalFields(worktree)}  unread:${worktree.unread ? 'yes' : 'no'}${formatWorktreePsProgramStatus(worktree.agents)}\n${worktree.path}${formatWorktreePsLocation(worktree)}${worktree.preview ? `\npreview: ${worktree.preview}` : ''}`
    )
    .join('\n\n')
  const bodyWithScope = `${body}\n\n${scope}`
  return result.truncated
    ? `${bodyWithScope}\ntruncated: showing ${result.worktrees.length} of ${result.totalCount}`
    : bodyWithScope
}

function formatWorktreePsLocation(worktree: AnnotatedPsRow): string {
  const annotation = workspaceAnnotationOf(worktree)
  return annotation
    ? `${formatParentLine(annotation)}${formatAddressLines(annotation)}`
    : formatWorktreePsParent(worktree)
}

/** The parent line, in the sidebar's precedence: worktree, then folder workspace, then another machine. */
function formatWorktreePsParent(worktree: RuntimeWorktreePsResult['worktrees'][number]): string {
  const parent =
    worktree.parentWorktreeId ??
    worktree.workspaceLineage?.parentWorkspaceKey ??
    (worktree.crossStoreParent
      ? `${worktree.crossStoreParent.parent.workspaceKey} on another machine`
      : null)
  return parent ? `\nparent: ${parent}` : ''
}

export function formatRepoList(result: RuntimeRepoList): string {
  if (result.repos.length === 0) {
    return 'No repos found.'
  }
  return result.repos.map((repo) => `${repo.id}  ${repo.displayName}  ${repo.path}`).join('\n')
}

export function formatRepoShow(result: { repo: Record<string, unknown> }): string {
  return Object.entries(result.repo)
    .map(
      ([key, value]) =>
        `${key}: ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`
    )
    .join('\n')
}

export function formatRepoRefs(result: RuntimeRepoSearchRefs): string {
  if (result.refs.length === 0) {
    return 'No refs found.'
  }
  return result.truncated ? `${result.refs.join('\n')}\n\ntruncated: yes` : result.refs.join('\n')
}

export function formatWorktreeList(
  result: WithAnnotatedHostScope<RuntimeWorktreeListResult>
): string {
  const scope = formatListingHostScope(result.hostScope)
  if (result.worktrees.length === 0) {
    return `No worktrees found.\n${scope}`
  }
  const body = result.worktrees
    .map((worktree) => {
      const childCount = worktree.childWorktreeIds?.length ?? 0
      return `${String(worktree.id)}  ${String(worktree.branch)}  host=${String(worktree.hostId ?? 'unverifiable')}  ${String(worktree.path)}\ndisplayName: ${String(worktree.displayName ?? '')}\nparentWorktreeId: ${String(worktree.parentWorktreeId ?? 'null')}\nchildWorktreeIds: ${childCount > 0 ? worktree.childWorktreeIds.join(',') : '[]'}\nlinkedIssue: ${String(worktree.linkedIssue ?? 'null')}\ncomment: ${String(worktree.comment ?? '')}`
    })
    .join('\n\n')
  const bodyWithScope = `${body}\n\n${scope}`
  return result.truncated
    ? `${bodyWithScope}\ntruncated: showing ${result.worktrees.length} of ${result.totalCount}`
    : bodyWithScope
}

const ANNOTATION_KEYS = new Set(['environment', 'address', 'addressUnavailable', 'parent'])

function workspaceAnnotationOf(record: Partial<WorkspaceAnnotation>): WorkspaceAnnotation | null {
  const { environment, address, addressUnavailable, parent } = record
  return environment
    ? {
        environment,
        address: address ?? null,
        parent: parent ?? null,
        ...(addressUnavailable ? { addressUnavailable } : {})
      }
    : null
}

export function formatWorktreeShow(result: {
  worktree: RuntimeWorktreeRecord & Partial<WorkspaceAnnotation>
}): string {
  const worktree = result.worktree
  const annotation = workspaceAnnotationOf(worktree)
  const fields = Object.entries(worktree)
    .filter(([key]) => !annotation || !ANNOTATION_KEYS.has(key))
    .map(
      ([key, value]) =>
        `${key}: ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`
    )
    .join('\n')
  return annotation
    ? `${fields}${formatParentLine(annotation)}${formatAddressLines(annotation)}`
    : fields
}
