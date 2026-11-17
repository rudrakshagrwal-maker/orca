// RA: boot gate. Launch the packaged Windows app with a fresh profile, open a terminal and a
// browser tab through the bundled CLI, and fail on any crash report. Typecheck and unit tests
// cannot see a renderer error boundary; this can.
import { spawn, execFile } from 'node:child_process'
import { existsSync, readFileSync, mkdtempSync, writeFileSync, realpathSync, openSync } from 'node:fs'
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

// Why debug port + main logging: when the browser step fails, the gate prints renderer and main state.
const mainLog = join(tmpdir(), 'orca-boot-main.log')
const logFd = openSync(mainLog, 'w')
const app = spawn(appExe, ['--remote-debugging-port=9334', '--enable-logging'], {
  detached: true,
  stdio: ['ignore', logFd, logFd],
  windowsHide: false,
  env: { ...process.env, ELECTRON_ENABLE_LOGGING: '1' }
})
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
  await diagnoseBrowser()
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

async function diagnoseBrowser() {
  try {
    const list = await (await fetch('http://127.0.0.1:9334/json/list')).json()
    console.log('[boot-gate] cdp targets:', list.map((t) => `${t.type}:${t.url.slice(0, 50)}`).join(' | '))
    const page = list.find((t) => t.type === 'page')
    const ws = new WebSocket(page.webSocketDebuggerUrl)
    let n = 0
    const pending = new Map()
    ws.onmessage = (m) => {
      const d = JSON.parse(m.data)
      if (d.id && pending.has(d.id)) pending.get(d.id)(d.result)
    }
    await new Promise((r) => (ws.onopen = r))
    const probe = async () => {
      const out = []
      for (const v of document.querySelectorAll('[data-browser-page-viewport-id]')) {
        const id = v.dataset.browserPageViewportId
        const w = v.querySelector('webview')
        let wc = 'none'
        let reg = '?'
        if (w) {
          try {
            wc = w.getWebContentsId()
            reg = await window.api.browser.isGuestRegistered({ browserPageId: id, webContentsId: wc })
          } catch (e) {
            wc = 'ERR ' + e.message
          }
        }
        out.push(`${id.slice(0, 8)} display=${v.style.display} webview=${!!w} src=${w?.getAttribute('src')} wcid=${wc} registered=${reg}`)
      }
      return out.join('\n') || 'no page viewports'
    }
    const r = await new Promise((res) => {
      const i = ++n
      pending.set(i, res)
      ws.send(JSON.stringify({ id: i, method: 'Runtime.evaluate', params: { expression: `(${probe.toString()})()`, returnByValue: true, awaitPromise: true } }))
    })
    console.log('[boot-gate] renderer pages:\n' + JSON.stringify(r?.result?.value ?? r))
    ws.close()
  } catch (error) {
    console.log('[boot-gate] cdp probe failed: ' + error.message)
  }
  try {
    const log = readFileSync(join(tmpdir(), 'orca-boot-main.log'), 'utf8')
    const lines = log.split(/\r?\n/).filter((l) => /browser|webview|guest|partition|error|warn/i.test(l))
    console.log('[boot-gate] main log (filtered, last 60):\n' + lines.slice(-60).join('\n'))
  } catch (error) {
    console.log('[boot-gate] no main log: ' + error.message)
  }
}
