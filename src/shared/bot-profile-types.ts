export type BotChat = {
  id: string
  title: string
  preview: string
  updatedAt: number
}

export type BotProfile = {
  key: string
  id: string
  label: string
  source: 'hermes' | 'dsh'
  home: string
  application: 'local TUI' | 'remote TUI' | 'web host' | 'headless' | 'unverified application'
  chats?: BotChat[]
  error?: string
}
export type BotProfileSnapshot = {
  profiles: BotProfile[]
  lastSuccess: number | null
  error?: string
  installed?: boolean
}
export type BotLaunch = {
  agentArgs: string
  label: string
}

export type BotTerminalIdentity = Pick<BotProfile, 'key' | 'id' | 'source' | 'home'> & {
  remotePath?: string
}
