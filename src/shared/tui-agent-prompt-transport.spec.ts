/** Pin the pre-launch transport predicate to buildAgentStartupPlan’s followupPrompt verdict for every agent so table drift cannot lose prompts. */

import { describe, expect, it } from 'vitest'
import { TUI_AGENT_CONFIG } from './agent-launch/catalog/tui-agent-config'
import {
  agentPromptRidesLaunchCommand,
  buildAgentStartupPlan
} from './agent-launch/startup/tui-agent-startup'
import type { TuiAgent } from './agent-launch/catalog/tui-agent'
import { getOpenCodeCliCapabilities } from './opencode-cli-version'

// oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the config is declared as a total record over TuiAgent, so its own keys are that union.
const ALL_AGENTS = Object.keys(TUI_AGENT_CONFIG) as TuiAgent[]

const PROMPT = 'summarize the diff'

function planFor(agent: TuiAgent) {
  return buildAgentStartupPlan({
    agent,
    prompt: PROMPT,
    cmdOverrides: {},
    platform: 'darwin'
  })
}

describe('the prompt-transport predicate against the plan it predicts', () => {
  it.each(['2.0.12', '2.0.16'])(
    'uses plugin-free followup submission for prefill-mode OpenCode %s',
    (version) => {
      expect(getOpenCodeCliCapabilities(version).promptMode).toBe('prefill')
      for (const agent of ['opencode', 'opencode2'] as const) {
        const plan = planFor(agent)!
        expect(plan.launchCommand).not.toContain('--prompt')
        expect(plan.env ?? {}).not.toHaveProperty('ORCA_OPENCODE_STARTUP_PROMPT_SHA256')
        expect(plan.followupPrompt).toBe(PROMPT)
        expect(agentPromptRidesLaunchCommand(agent)).toBe(false)
      }
    }
  )
  // An empty agent list would make the contract vacuously pass.

  it('puts the prompt in the launch command exactly when it says it does', () => {
    for (const agent of ALL_AGENTS) {
      const plan = planFor(agent)
      if (!agentPromptRidesLaunchCommand(agent)) {
        // The command must not smuggle the text in some other way.
        expect(plan!.launchCommand).not.toContain(PROMPT)
        expect(plan!.followupPrompt).toBe(PROMPT)
        continue
      }
      // Hermes hands long text through an env var, so the command names the variable, not the text.
      const carried =
        plan!.launchCommand.includes(PROMPT) ||
        Object.values(plan!.env ?? {}).some((value) => value.includes(PROMPT))
      expect(carried, `${agent} claims its launch command carries the prompt`).toBe(true)
    }
  })
})
