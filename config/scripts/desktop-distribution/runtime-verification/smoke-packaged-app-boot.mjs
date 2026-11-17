// RA: boot gate. Launch the packaged Windows app with a fresh profile, open a terminal and a
// browser tab through the bundled CLI, and fail on any crash report. Typecheck and unit tests
// cannot see a renderer error boundary; this can.
import { spawn, execFile } from 'node:child_process'
import { existsSync, readFileSync, mkdtempSync, writeFileSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { promisify } from 'node:util'

const run = promisify(execFile)
const appDir = resolve(process.argv[2] ?? 'dist/win-unpacked')
const appExe = join(appDir, 'Orca.exe')
const cli = join(appDir, 'resources', 'bin', 'orca.exe')
const userData = join(process.env.APPDATA ?? '', 'Orca-RA')
const crashFile = join(userData, 'crash-reports.json')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function fail(message) {
  console.error(`[boot-gate] FAIL: ${message}`)
  process.exitCode = 1
}

async function orca(args, timeout = 60_000) {
  let stdout
  try {
    ;({ stdout } = await run(cli, [...args, '--json'], { timeout, windowsHide: true }))
  } catch (error) {
    // Why: the CLI prints its JSON error on stdout with a non-zero exit; surface it.
    throw new Error(`orca ${args.join(' ')}: ${(error.stdout || '').trim() || error.message} ${(error.stderr || '').trim()}`)
  }
  const parsed = JSON.parse(stdout)
  if (!parsed.ok) throw new Error(`orca ${args.join(' ')}: ${JSON.stringify(parsed.error)}`)
  return parsed.result
}

function crashReports() {
  if (!existsSync(crashFile)) return []
  const data = JSON.parse(readFileSync(crashFile, 'utf8'))
  const list = Array.isArray(data) ? data : (data.reports ?? Object.values(data).flat())
  return list.filter((r) => r && typeof r === 'object')
}

async function waitFor(label, probe, ms) {
  const deadline = Date.now() + ms
  let last
  while (Date.now() < deadline) {
    try {
      const value = await probe()
      if (value) return value
    } catch (error) {
      last = error
    }
    await sleep(1500)
  }
  throw new Error(`${label} timed out${last ? `: ${last.message}` : ''}`)
}

if (!existsSync(appExe) || !existsSync(cli)) {
  fail(`missing ${appExe} or ${cli}`)
  process.exit()
}

const app = spawn(appExe, [], { detached: true, stdio: 'ignore', windowsHide: false })
app.unref()

try {
  await waitFor(
    'runtime ready',
    async () => (await orca(['status'])).runtime?.state === 'ready',
    120_000
  )
  console.log('[boot-gate] runtime ready')

  // Why native realpath: the runner's TEMP is an 8.3 short path (RUNNER~1) that Orca registers long.
  const repo = realpathSync.native(mkdtempSync(join(tmpdir(), 'orca-boot-')))
  writeFileSync(join(repo, 'README.md'), 'boot gate\n')
  await run('git', ['init', '-q'], { cwd: repo })
  await run('git', ['-c', 'user.email=ci@local', '-c', 'user.name=ci', 'add', '.'], { cwd: repo })
  await run('git', ['-c', 'user.email=ci@local', '-c', 'user.name=ci', 'commit', '-qm', 'init'], {
    cwd: repo
  })
  await orca(['repo', 'add', '--path', repo])
  const worktree = `path:${repo}`

  const created = await orca(['terminal', 'create', '--worktree', worktree, '--title', 'boot', '--focus'])
  const handle = created.terminal.handle
  await sleep(3000)
  await orca(['terminal', 'send', '--terminal', handle, '--text', 'echo BOOT-GATE-$((6*7))', '--enter'])
  await waitFor(
    'terminal echo',
    async () => {
      const { stdout } = await run(cli, ['terminal', 'read', '--terminal', handle], {
        timeout: 30_000,
        windowsHide: true
      })
      return stdout.includes('BOOT-GATE-42')
    },
    45_000
  )
  console.log('[boot-gate] terminal round-trip ok')

  const tab = await orca(['tab', 'create', '--url', 'about:blank', '--worktree', worktree])
  // Why retry: the guest registers asynchronously after its <webview> attaches.
  await waitFor(
    'browser tab switch',
    async () => {
      await orca(['tab', 'switch', '--page', tab.browserPageId, '--worktree', worktree, '--focus'], 20_000)
      return true
    },
    30_000
  )
  await waitFor(
    'browser tab registered',
    async () => {
      await orca(['tab', 'current', '--worktree', worktree], 20_000)
      return true
    },
    45_000
  )
  console.log('[boot-gate] browser tab registered')

  // The 17 Nov crash fired on terminal dispose, so exercise unmount too.
  await orca(['terminal', 'close', '--terminal', handle])
  await sleep(10_000)
} catch (error) {
  fail(error.message)
} finally {
  const reports = crashReports()
  for (const r of reports) {
    fail(
      `crash report: ${r.source}/${r.reason} ${r.details?.boundary_id ?? ''} ${r.details?.error_message ?? ''}`
    )
  }
  if (!process.exitCode) console.log('[boot-gate] PASS: no crash reports')
  try {
    await run('taskkill', ['/F', '/T', '/IM', 'Orca.exe'], { windowsHide: true })
  } catch {}
}
