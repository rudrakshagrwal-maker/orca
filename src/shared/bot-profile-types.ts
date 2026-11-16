// RA: Catalogue identities contain no credentials or executable renderer input.
export type BotProfile = {
  key: string
  id: string
  label: string
  source: 'hermes' | 'dsh'
  home: string
  application: 'remote TUI' | 'web host' | 'headless' | 'unverified application'
}
export type BotProfileSnapshot = {
  profiles: BotProfile[]
  lastSuccess: number | null
  error?: string
}
export type BotLaunch = {
  command: string
  shell: string
  env?: Record<string, string>
  label: string
  identity: BotTerminalIdentity // RA: saved identity, never the executable command.
}

export type BotTerminalIdentity = Pick<BotProfile, 'key' | 'id' | 'source' | 'home'> & { remotePath?: string }
