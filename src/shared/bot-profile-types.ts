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
  host?: string
  application: 'local TUI' | 'remote TUI' | 'web host' | 'headless' | 'unverified application'
  chats?: BotChat[]
  error?: string
}
export type BotProfileSnapshot = {
  profiles: BotProfile[]
  lastSuccess: number | null
  error?: string
  installed?: boolean
  peers?: { name: string; error?: string }[]
}
export type BotLaunch = {
  agentArgs: string
  label: string
  command?: string
}

export type HermesPeer = {
  name: string
  host: string
  user: string
  keyPath: string
  remoteUser: string
  hermesHome: string
  hermesBin: string
}

export type BotTerminalIdentity = Pick<BotProfile, 'key' | 'id' | 'source' | 'home'> & {
  remotePath?: string
}

export type OpenBotChatResult = {
  sessionId: string
  nativeSessionId: string | null
  worktreeId: string
}
