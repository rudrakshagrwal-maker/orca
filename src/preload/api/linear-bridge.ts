import { invokeRestoredFeature } from './restored-feature-invoke' // RA: first-use gate.
import type { LinearProjectDetail } from '../../shared/linear/project-types'
import type { PreloadApi } from '../api-types'

export const linearApi = {
  connect: (args: { apiKey: string }) => invokeRestoredFeature('task-providers', 'linear:connect', args),

  disconnect: (args?: { workspaceId?: string }): Promise<void> =>
    invokeRestoredFeature('task-providers', 'linear:disconnect', args),

  selectWorkspace: (args: { workspaceId: string }) =>
    invokeRestoredFeature('task-providers', 'linear:selectWorkspace', args),

  status: () => invokeRestoredFeature('task-providers', 'linear:status'),

  testConnection: (args?: { workspaceId?: string }) =>
    invokeRestoredFeature('task-providers', 'linear:testConnection', args),

  searchIssues: (args: { query: string; limit?: number; workspaceId?: string }) =>
    invokeRestoredFeature('task-providers', 'linear:searchIssues', args),

  listIssues: (args?: {
    filter?: 'assigned' | 'created' | 'all' | 'completed'
    limit?: number
    workspaceId?: string
    attributeFilter?: unknown
  }) => invokeRestoredFeature('task-providers', 'linear:listIssues', args),

  createIssue: (args: {
    teamId: string
    title: string
    description?: string
    workspaceId?: string
    parentIssueId?: string
    projectId?: string | null
    stateId?: string
    priority?: number
    assigneeId?: string | null
    labelIds?: string[]
  }): Promise<
    | { ok: true; id: string; identifier: string; title: string; url: string }
    | { ok: false; error: string }
  > => invokeRestoredFeature('task-providers', 'linear:createIssue', args),

  getIssue: (args: { id: string; workspaceId?: string }) =>
    invokeRestoredFeature('task-providers', 'linear:getIssue', args),

  updateIssue: (args: {
    id: string
    updates: unknown
    workspaceId?: string
  }): Promise<{ ok: true } | { ok: false; error: string }> =>
    invokeRestoredFeature('task-providers', 'linear:updateIssue', args),

  addIssueComment: (args: {
    issueId: string
    body: string
    workspaceId?: string
  }): Promise<{ ok: true; id: string } | { ok: false; error: string }> =>
    invokeRestoredFeature('task-providers', 'linear:addIssueComment', args),

  issueComments: (args: { issueId: string; workspaceId?: string }) =>
    invokeRestoredFeature('task-providers', 'linear:issueComments', args),

  listTeams: (args?: { workspaceId?: string }) => invokeRestoredFeature('task-providers', 'linear:listTeams', args),

  listProjects: (args?: {
    query?: string
    limit?: number
    workspaceId?: string
    force?: boolean
  }) => invokeRestoredFeature('task-providers', 'linear:listProjects', args),

  createProject: (args: {
    name: string
    description?: string
    content?: string
    teamIds: string[]
    workspaceId?: string
    leadId?: string | null
    memberIds?: string[]
    labelIds?: string[]
    priority?: number
    startDate?: string
    targetDate?: string
  }): Promise<{ ok: true; project: LinearProjectDetail } | { ok: false; error: string }> =>
    invokeRestoredFeature('task-providers', 'linear:createProject', args),

  getProject: (args: { id: string; workspaceId: string; force?: boolean }) =>
    invokeRestoredFeature('task-providers', 'linear:getProject', args),

  listProjectIssues: (args: {
    projectId: string
    limit?: number
    workspaceId: string
    force?: boolean
  }) => invokeRestoredFeature('task-providers', 'linear:listProjectIssues', args),

  listCustomViews: (args: {
    model: string
    limit?: number
    workspaceId?: string
    force?: boolean
  }) => invokeRestoredFeature('task-providers', 'linear:listCustomViews', args),

  getCustomView: (args: { viewId: string; model: string; workspaceId: string; force?: boolean }) =>
    invokeRestoredFeature('task-providers', 'linear:getCustomView', args),

  listCustomViewIssues: (args: {
    viewId: string
    limit?: number
    workspaceId: string
    force?: boolean
  }) => invokeRestoredFeature('task-providers', 'linear:listCustomViewIssues', args),

  listCustomViewProjects: (args: {
    viewId: string
    limit?: number
    workspaceId: string
    force?: boolean
  }) => invokeRestoredFeature('task-providers', 'linear:listCustomViewProjects', args),

  teamStates: (args: { teamId: string; workspaceId?: string }) =>
    invokeRestoredFeature('task-providers', 'linear:teamStates', args),

  teamLabels: (args: { teamId: string; workspaceId?: string }) =>
    invokeRestoredFeature('task-providers', 'linear:teamLabels', args),

  teamMembers: (args: { teamId: string; workspaceId?: string }) =>
    invokeRestoredFeature('task-providers', 'linear:teamMembers', args)
} satisfies PreloadApi['linear']
