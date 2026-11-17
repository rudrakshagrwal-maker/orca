// Electron is unavailable in main-process worker threads too (verified Electron 43); scan their graphs rather than trusting entry comments.
export const WORKER_THREAD_ENTRY_NAMES = [
  'warp-theme-parser-worker',
  'session-search-worker-entry',
  'main-thread-hang-watchdog-entry',
  'command-path-directory-worker-entry',
  'worker-thread-child-process-entry',
  'claude-profile-setup-worker-entry',
  ...(['backup', 'writer'] as const).map((kind) => `profile-state-${kind}-worker-entry` as const)
] as const
