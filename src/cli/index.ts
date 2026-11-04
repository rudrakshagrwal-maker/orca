#!/usr/bin/env node
import { ROOT_SHORT_HELP } from './root-short-help'

// RA: root help loads only this text, never specs, dispatch, discovery or the runtime graph.
export async function main(argv = process.argv.slice(2), cwd?: string): Promise<void> {
  if (
    argv.length === 0 ||
    (argv.length === 1 && ['--help', '-h', 'help'].includes(argv[0]))
  ) {
    console.log(ROOT_SHORT_HELP)
    return
  }
  await (await import('./command-main.js')).main(argv, cwd)
}

if (require.main === module) {
  void main()
}
