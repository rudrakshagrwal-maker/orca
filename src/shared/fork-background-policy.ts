// RA: optional background collection stays off; retained agents still need their status hooks.
export function backgroundJobsDisabled(): boolean {
  return true
}

export function preserveGlobalAgentConfiguration(): boolean {
  // RA: the source registry limits configuration writes to Claude Code and Codex.
  return false
}
