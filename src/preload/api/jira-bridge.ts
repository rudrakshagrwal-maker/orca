import { invokeRestoredFeature } from './restored-feature-invoke' // RA: first-use gate.
import type { JiraMediaFormat } from '../../shared/jira/jira-attachment-image'
import type {
  JiraIssueSummaryGenerationRequest,
  JiraIssueSummaryGenerationCancellation
} from '../../shared/jira/jira-issue-summary-generation'
import type { JiraIssueListFilters, JiraProjectStatusOrder } from '../../shared/jira/jira-types'
import type { PreloadApi } from '../api-types'

export const jiraApi = {
  connect: (args: {
    siteUrl: string
    email: string
    apiToken: string
    authType?: 'cloud' | 'server'
  }) => invokeRestoredFeature('task-providers', 'jira:connect', args),

  disconnect: (args?: { siteId?: string }): Promise<void> =>
    invokeRestoredFeature('task-providers', 'jira:disconnect', args),

  selectSite: (args: { siteId: string }) => invokeRestoredFeature('task-providers', 'jira:selectSite', args),

  status: () => invokeRestoredFeature('task-providers', 'jira:status'),

  readStatus: () => invokeRestoredFeature('task-providers', 'jira:readStatus'),

  testConnection: (args?: { siteId?: string }) => invokeRestoredFeature('task-providers', 'jira:testConnection', args),

  searchIssues: (args: { jql: string; limit?: number; siteId?: string; requestId?: string }) =>
    invokeRestoredFeature('task-providers', 'jira:searchIssues', args),
  cancelSearchIssues: (args: { requestId: string }): Promise<void> =>
    invokeRestoredFeature('task-providers', 'jira:cancelSearchIssues', args),

  listIssues: (args?: {
    filter?: 'assigned' | 'reported' | 'all' | 'done'
    filters?: JiraIssueListFilters
    limit?: number
    siteId?: string
  }) => invokeRestoredFeature('task-providers', 'jira:listIssues', args),

  getIssue: (args: { key: string; siteId?: string; mediaFormat?: JiraMediaFormat }) =>
    invokeRestoredFeature('task-providers', 'jira:getIssue', args),

  lookupIssueSummary: (args: { key: string; siteId: string; requestId?: string }) =>
    invokeRestoredFeature('task-providers', 'jira:lookupIssueSummary', args),
  cancelIssueSummary: (args: { requestId: string }): Promise<void> =>
    invokeRestoredFeature('task-providers', 'jira:cancelIssueSummary', args),

  createIssue: (args: {
    siteId?: string
    projectId: string
    issueTypeId: string
    title: string
    description?: string
    customFields?: Record<string, unknown>
    userFieldKeys?: string[]
  }): Promise<{ ok: true; id: string; key: string; url: string } | { ok: false; error: string }> =>
    invokeRestoredFeature('task-providers', 'jira:createIssue', args),

  generateIssueSummary: (args: JiraIssueSummaryGenerationRequest) =>
    invokeRestoredFeature('task-providers', 'jira:generateIssueSummary', args),
  cancelGenerateIssueSummary: (args: JiraIssueSummaryGenerationCancellation): Promise<void> =>
    invokeRestoredFeature('task-providers', 'jira:cancelGenerateIssueSummary', args),

  updateIssue: (args: {
    key: string
    updates: unknown
    siteId?: string
  }): Promise<{ ok: true } | { ok: false; error: string }> =>
    invokeRestoredFeature('task-providers', 'jira:updateIssue', args),

  addIssueComment: (args: {
    key: string
    body: string
    siteId?: string
  }): Promise<{ ok: true; id: string } | { ok: false; error: string }> =>
    invokeRestoredFeature('task-providers', 'jira:addIssueComment', args),

  issueComments: (args: { key: string; siteId?: string; mediaFormat?: JiraMediaFormat }) =>
    invokeRestoredFeature('task-providers', 'jira:issueComments', args),

  listProjects: (args?: { siteId?: string }) => invokeRestoredFeature('task-providers', 'jira:listProjects', args),

  listFavouriteFilters: (args: { siteId: string }) =>
    invokeRestoredFeature('task-providers', 'jira:listFavouriteFilters', args),

  listIssueTypes: (args: { projectIdOrKey: string; siteId?: string }) =>
    invokeRestoredFeature('task-providers', 'jira:listIssueTypes', args),

  listCreateFields: (args: { projectIdOrKey: string; issueTypeId: string; siteId?: string }) =>
    invokeRestoredFeature('task-providers', 'jira:listCreateFields', args),

  listPriorities: (args?: { siteId?: string }) => invokeRestoredFeature('task-providers', 'jira:listPriorities', args),

  listAssignableUsers: (args: { key: string; query?: string; siteId?: string }) =>
    invokeRestoredFeature('task-providers', 'jira:listAssignableUsers', args),
  listAssignableUsersForProject: (args: {
    projectIdOrKey: string
    query?: string
    siteId?: string
  }) => invokeRestoredFeature('task-providers', 'jira:listAssignableUsersForProject', args),
  searchUsers: (args?: { query?: string; siteId?: string }) =>
    invokeRestoredFeature('task-providers', 'jira:searchUsers', args),

  listTransitions: (args: { key: string; siteId?: string; strict?: boolean }) =>
    invokeRestoredFeature('task-providers', 'jira:listTransitions', args),
  getProjectStatusOrder: (args: {
    projectKey: string
    siteId?: string
  }): Promise<JiraProjectStatusOrder> => invokeRestoredFeature('task-providers', 'jira:getProjectStatusOrder', args)
} satisfies PreloadApi['jira']
