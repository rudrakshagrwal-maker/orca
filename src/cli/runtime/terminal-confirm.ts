// RA: retain the generic CLI confirmation without plugin tooling.
import { createInterface } from 'node:readline'
type TerminalConfirm = (question: string) => Promise<boolean>
type PromptStreams = {
  input: NodeJS.ReadableStream & { isTTY?: boolean }
  output: NodeJS.WritableStream & { isTTY?: boolean }
}

/** A prompt only for a person at a terminal; agents, pipes and `--json` keep the exit-3 error. */
export function terminalConfirmFor(
  json: boolean,
  streams: PromptStreams = { input: process.stdin, output: process.stdout }
): TerminalConfirm | undefined {
  return !json && streams.input.isTTY && streams.output.isTTY
    ? createTerminalConfirm(streams)
    : undefined
}

/** readline works the same in Windows cmd, PowerShell and Windows Terminal as on POSIX ttys. */
export function createTerminalConfirm(streams: PromptStreams): TerminalConfirm {
  return (question) =>
    new Promise((resolve) => {
      const rl = createInterface({ input: streams.input, output: streams.output })
      let answered = false
      const finish = (yes: boolean): void => {
        if (answered) {
          return
        }
        answered = true
        rl.close()
        resolve(yes)
      }
      // Why: with no SIGINT listener readline only pauses on Ctrl-C, leaving the prompt hanging.
      rl.on('SIGINT', () => {
        streams.output.write('\n')
        finish(false)
      })
      rl.on('close', () => {
        if (!answered) {
          streams.output.write('\n')
        }
        finish(false)
      })
      rl.question(question, (answer) => finish(/^y(es)?$/i.test(answer.trim())))
    })
}
