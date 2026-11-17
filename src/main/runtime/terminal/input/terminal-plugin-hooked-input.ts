// RA: terminal writes go directly to orchestration delivery; plugin interception is removed.
import type { RuntimeTerminalSend } from '../../../../shared/runtime-terminal-send-contract'
import type { RuntimeTerminalWriteOptions } from './runtime-terminal-writer'
import { OrcaRuntimeWithControllerKnowsPtyIsLive } from './terminal-input-dispatch'
import type { RuntimeAgentPromptWriteOptions } from './agent-prompt-write-options'
type TerminalSendAction = { text?: string; enter?: boolean; interrupt?: boolean }
export abstract class OrcaRuntimeWithPluginHookedTerminalInput extends OrcaRuntimeWithControllerKnowsPtyIsLive {
  sendTerminal(
    handle: string,
    action: TerminalSendAction,
    options: RuntimeTerminalWriteOptions
  ): Promise<RuntimeTerminalSend> {
    return this.sendTerminalAfterPluginHooks(handle, action, options)
  }
  sendTerminalAgentPrompt(
    handle: string,
    prompt: string,
    options: RuntimeAgentPromptWriteOptions
  ): Promise<RuntimeTerminalSend> {
    return this.sendAgentPromptAfterPluginHooks(handle, prompt, options)
  }
}
