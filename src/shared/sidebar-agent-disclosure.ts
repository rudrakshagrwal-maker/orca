// RA: agent rows are always visible; discard retired per-card disclosure preferences.
export function normalizeSidebarCollapsedGroups(keys: readonly string[] = []): string[] {
  return keys.filter((key) => !key.startsWith('ra:project-agent-open:'))
}
