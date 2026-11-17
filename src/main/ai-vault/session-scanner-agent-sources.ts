import { homedir } from 'node:os'
import { basename, join } from 'node:path'

import type { AiVaultAgent } from '../../shared/ai-vault/contracts/ai-vault-types'
import type { AiVaultDeletableAgent } from '../../shared/ai-vault/contracts/ai-vault-session-deletion'

import { uniqueCodexSessionsDirs } from './scanners/codex/session-scanner-codex-paths'

import {
  claudeProjectsRootDirs,
  codexHomeSessionsDir,
  wslHomeSessionDirs
} from './session-scanner-roots'

import { isClaudeProjectBucketDirectory } from './scanners/claude/claude-project-dir-encoding'

import type { AiVaultScanOptions } from './session-scanner-types'

export const DEFAULT_CODEX_HOME_DIR = join(homedir(), '.codex')

/** Shared discovery rules constrain which paths the delete validator accepts. */
export type AiVaultAgentSource = {
  // Resolve lazily: module-time Grok resolution breaks cross-chunk initialization ordering.
  rootDirs: (options: AiVaultScanOptions, wslHomeDirs: readonly string[]) => string[]
  extensions: readonly string[]
  filePredicate?: (filePath: string) => boolean
  // Sidecar stats affect freshness and recency; async resolution supports non-derived paths.
  contentDependencyPath?: (filePath: string) => string | undefined | Promise<string | undefined>
  // Return false to skip a directory; depth 0 is a child of the root.
  directoryPredicate?: (name: string, depth: number) => boolean
  // Share the per-agent limit across alternate roots for one install.
  mergeRootDiscoveries?: boolean
}

type AiVaultAgentSourceTable = Partial<Record<AiVaultAgent, AiVaultAgentSource>>

// OpenCode and Antigravity use dedicated discovery for their storage layouts.
export const AI_VAULT_AGENT_SOURCES: AiVaultAgentSourceTable = {
  claude: {
    rootDirs: (options, wslHomeDirs) =>
      claudeProjectsRootDirs({
        claudeProjectsDir: options.claudeProjectsDir,
        wslHomeDirs,
        claudeProfileProjectsDirs: options.claudeProfileProjectsDirs
      }),
    extensions: ['.jsonl'],
    // Subagent transcripts are read under their parent instead of duplicating History rows.
    directoryPredicate: isClaudeProjectBucketDirectory
  },

  codex: {
    rootDirs: (options, wslHomeDirs) =>
      uniqueCodexSessionsDirs([
        options.codexSessionsDir ?? codexHomeSessionsDir(),
        ...wslHomeSessionDirs('codex', wslHomeDirs),
        ...(options.additionalCodexSessionsDirs ?? [])
      ]),
    // Codex archives rollouts idle 7+ days as .jsonl.zst (#40312); only rollout-named archives.
    extensions: ['.jsonl', '.zst'],
    filePredicate: (filePath) =>
      !filePath.toLowerCase().endsWith('.zst') ||
      /^rollout-.+\.jsonl\.zst$/.test(basename(filePath))
  }
}

// The Pi walk labels the OMP transcripts it reads, so an OMP row can sit under Pi's roots too.
export function sessionRowRootDirs(
  agent: AiVaultDeletableAgent,
  options: AiVaultScanOptions,
  wslHomeDirs: readonly string[]
): string[] {
  // RA: removed providers have no filesystem discovery roots.
  return AI_VAULT_AGENT_SOURCES[agent]?.rootDirs(options, wslHomeDirs) ?? []
}

export { isDiscoverableSessionFile } from './session-file-discovery'
