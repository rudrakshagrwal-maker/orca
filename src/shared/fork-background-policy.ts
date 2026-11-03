// RA: this fork runs without background collection or agent configuration writes.
export function backgroundJobsDisabled(): boolean {
  return true
}

export function preserveGlobalAgentConfiguration(): boolean {
  return true
}
