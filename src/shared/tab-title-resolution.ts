import type { AiVaultSessionTitle } from './ai-vault/contracts/ai-vault-session-title'
import type { Tab } from './tab-types'
import type { TerminalTab } from './workspace-layout/terminal-tab-types'
import { isMeaningfulOpenCodeTerminalTitle } from './agent-status/title/providers/opencode-terminal-title'
import { resolveTerminalTitleAgentType } from './agent-status/title/terminal-title-agent-type'
import { stripLeadingAgentTitleDecorationOrEmpty } from './agent-status/title/agent-title-decoration'

// RA: numbered shell labels and provider status labels are not session names.
export function meaningfulAgentSessionTitle(title: string): string {
  const name = stripLeadingAgentTitleDecorationOrEmpty(title.trim()).trim()
  return /^(?:terminal\s+\d+|agent|claude(?: code)?|codex|(?:claude|codex)\s+(?:ready|idle|done|working|thinking|running)|ready|idle|done)$/i.test(
    name
  )
    ? ''
    : name
}

export function resolveAgentSessionTitle(
  tab: Pick<
    TerminalTab,
    'title' | 'customTitle' | 'aiVaultTitle' | 'generatedTitle' | 'quickCommandLabel'
  >,
  liveTitle: string | null | undefined,
  agentLabel: string,
  providerSessionId?: string
): string {
  // RA: share the live/session/fallback order between cards and tabs, independent of paid naming.
  return (
    tab.customTitle?.trim() ||
    meaningfulAgentSessionTitle(liveTitle ?? '') ||
    (!providerSessionId || tab.aiVaultTitle?.sessionId === providerSessionId
      ? tab.aiVaultTitle?.title.trim()
      : '') ||
    meaningfulAgentSessionTitle(tab.title) ||
    tab.generatedTitle?.trim() ||
    tab.quickCommandLabel?.trim() ||
    agentLabel
  )
}

export type TabNameSources = {
  /** A name the user typed into the tab. */
  customTitle?: string | null
  quickCommandLabel?: string | null
  /** The program's own terminal title right now. */
  liveTitle: string
  liveAgentTitle?: boolean
  /** The agent session's title, already checked to belong to this tab's session. */
  sessionTitle?: Pick<AiVaultSessionTitle, 'title' | 'kind'> | null
  generatedTitle?: string | null
}

/** The one name order every tab and agent-row surface uses; '' leaves the plain live title to the caller. */
export function resolveTabNameSource(
  sources: TabNameSources,
  generatedTitlesEnabled: boolean
): string {
  const sessionTitle = sources.sessionTitle?.title.trim() ?? ''
  // Why: a quick-command label only names the tab until the session has a name of its own (a rename or
  // a provider-generated name); a first-prompt stand-in does not replace it. A typed tab name wins over both.
  const sessionNamed = sources.sessionTitle?.kind === 'named'
  return (
    sources.customTitle?.trim() ||
    // RA: an agent's own OSC label outranks saved names and launch labels.
    (sources.liveAgentTitle ? sources.liveTitle : '') ||
    (isMeaningfulOpenCodeTerminalTitle(sources.liveTitle) ? sources.liveTitle : '') ||
    (sessionNamed ? sessionTitle : '') ||
    sources.quickCommandLabel?.trim() ||
    sessionTitle ||
    (generatedTitlesEnabled ? sources.generatedTitle?.trim() : '') ||
    ''
  )
}

export function resolveTerminalTabTitle(
  tab: Pick<TerminalTab, 'quickCommandLabel' | 'aiVaultTitle' | 'generatedTitle' | 'title'> & {
    customTitle?: string | null
    launchAgent?: TerminalTab['launchAgent']
    ptyId?: TerminalTab['ptyId']
  },
  generatedTitlesEnabled: boolean,
  fallback = ''
): string {
  const liveTitle = tab.title?.trim() ?? ''
  return (
    resolveTabNameSource(
      {
        customTitle: tab.customTitle,
        quickCommandLabel: tab.quickCommandLabel,
        liveTitle,
        liveAgentTitle:
          tab.ptyId !== null &&
          Boolean(tab.launchAgent || resolveTerminalTitleAgentType(liveTitle)),
        sessionTitle: tab.aiVaultTitle,
        generatedTitle: tab.generatedTitle
      },
      generatedTitlesEnabled
    ) ||
    liveTitle ||
    fallback
  )
}

export function resolveUnifiedTabLabel(
  tab:
    | Pick<Tab, 'customLabel' | 'quickCommandLabel' | 'aiVaultTitle' | 'generatedLabel' | 'label'>
    | undefined,
  generatedTitlesEnabled: boolean,
  fallback = ''
): string {
  const liveLabel = tab?.label?.trim() ?? ''
  return (
    resolveTabNameSource(
      {
        customTitle: tab?.customLabel,
        quickCommandLabel: tab?.quickCommandLabel,
        liveTitle: liveLabel,
        sessionTitle: tab?.aiVaultTitle,
        generatedTitle: tab?.generatedLabel
      },
      generatedTitlesEnabled
    ) ||
    liveLabel ||
    fallback
  )
}
