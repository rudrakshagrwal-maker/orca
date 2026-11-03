// Strip redundant leading status glyphs/prefixes only from known agent titles; the tab already shows the provider icon.
const LEADING_AGENT_TITLE_DECORATION_RE =
  /^(?:[\u2733\u2726\u23F2\u25C7\u270B\u25B2\u2800-\u28FF\u25D0-\u25D3]+|[.*]\s)\s*/

export function stripLeadingAgentTitleDecorationOrEmpty(title: string): string {
  return title.replace(LEADING_AGENT_TITLE_DECORATION_RE, '').trimStart()
}

export function stripLeadingAgentTitleDecoration(title: string): string {
  const stripped = stripLeadingAgentTitleDecorationOrEmpty(title)
  // Retain glyph-only titles rather than producing blank tab labels.
  return stripped.length > 0 ? stripped : title
}

// RA: agent-owned OSC titles stay trimmed, without inherited branch/path prefixes.
export function agentTerminalTitle(title: string): string {
  const parts = stripLeadingAgentTitleDecoration(title.trim()).split(/\s+(?:\u00c2?\u00b7|\u2014)\s+/)
  while (parts.length > 1 && /^(?:master|main)$|[\\/]/i.test(parts[0])) {
    parts.shift()
  }
  return parts.join(' · ').trim()
}
