import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildSkillDiscoverySources } from './skill-discovery-sources'
import { clearSkillRootScanCache, discoverSkills } from './skill-native-discovery'
import '../../../shared/agent-launch/catalog/tui-agent-config'

import type * as SkillRootFileWalk from './skill-root-file-walk'
import type { Repo } from '../../../shared/repo-types'

let unavailableRootPath: string | null = null

vi.mock('./skill-root-file-walk', async (importOriginal) => {
  const actual = await importOriginal<typeof SkillRootFileWalk>()
  return {
    ...actual,
    findSkillFiles: (rootPath: string, maxDepth: number, signal?: AbortSignal) => {
      if (unavailableRootPath !== null && rootPath === unavailableRootPath) {
        return Promise.reject(
          Object.assign(new Error('This operation was aborted'), {
            name: 'AbortError'
          })
        )
      }
      return actual.findSkillFiles(rootPath, maxDepth, signal)
    }
  }
})

function makeRepo(path: string, connectionId: string | null = null): Repo {
  return {
    id: `repo-${path}`,
    path,
    displayName: 'Repo',
    badgeColor: '#737373',
    addedAt: 1,
    kind: 'git',
    connectionId
  }
}

beforeEach(() => {
  // Reset shared scans because each case owns a different tree.
  clearSkillRootScanCache()
  // HERMES_HOME can escape the fixture; isolate it from developer installs.
  vi.stubEnv('HERMES_HOME', '')
  vi.stubEnv('LOCALAPPDATA', '')
  vi.spyOn(console, 'info').mockImplementation(() => undefined)
})

afterEach(() => {
  unavailableRootPath = null
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('skill discovery', () => {
  // An abandoned root must not empty the picker for healthy roots.

  // Unavailable means unknown, never proof that skills are missing.

  // Retain the last answered scan so stalled roots do not make installed skills offer Install.

  it('drops the retained copy once a root answers as absent', async () => {
    const root = await mkdtemp(join(tmpdir(), 'orca-skills-'))
    const home = join(root, 'home')
    const stalledRoot = join(home, '.omp', 'agent', 'skills')
    await mkdir(join(stalledRoot, 'planning'), { recursive: true })
    await writeFile(join(stalledRoot, 'planning', 'SKILL.md'), '# Planning\n\nPlan work.')
    await discoverSkills({ homeDir: home, cwd: join(root, 'missing-cwd') })
    await rm(stalledRoot, { recursive: true })

    await discoverSkills({ homeDir: home, cwd: join(root, 'missing-cwd'), refresh: true })
    unavailableRootPath = stalledRoot
    const result = await discoverSkills({
      homeDir: home,
      cwd: join(root, 'missing-cwd'),
      refresh: true
    })

    expect(result.skills.map((skill) => skill.name)).toEqual([])
  })



  it('filters discovery by requested directory name and source kind', async () => {
    const root = await mkdtemp(join(tmpdir(), 'orca-skills-'))
    const home = join(root, 'home')
    const repo = join(root, 'repo')
    const homeSkill = join(home, '.agents', 'skills', 'orchestration')
    const repoSkill = join(repo, '.agents', 'skills', 'orchestration')
    const unrelatedSkill = join(home, '.agents', 'skills', 'computer-use')
    await mkdir(homeSkill, { recursive: true })
    await mkdir(repoSkill, { recursive: true })
    await mkdir(unrelatedSkill, { recursive: true })
    await writeFile(join(homeSkill, 'SKILL.md'), '---\nname: Agent Orchestration\n---\n')
    await writeFile(join(repoSkill, 'SKILL.md'), '# orchestration')
    await writeFile(join(unrelatedSkill, 'SKILL.md'), '# computer-use')

    const result = await discoverSkills({
      homeDir: home,
      cwd: repo,
      repos: [],
      names: ['orchestration'],
      sourceKinds: ['home']
    })

    expect(result.skills).toMatchObject([
      { name: 'Agent Orchestration', sourceKind: 'home', directoryPath: homeSkill }
    ])
    expect(result.sources.every((source) => source.sourceKind === 'home')).toBe(true)

    const unfiltered = await discoverSkills({
      homeDir: home,
      cwd: repo,
      repos: [],
      sourceKinds: []
    })
    expect(unfiltered.skills.map((skill) => skill.name).sort()).toEqual([
      'Agent Orchestration',
      'computer-use',
      'orchestration'
    ])
  })

  it('discovers the enabled Claude plugin version applicable to the project cwd', async () => {
    const root = await mkdtemp(join(tmpdir(), 'orca-skills-'))
    const home = join(root, 'home')
    const project = join(root, 'project')
    const cwd = join(project, 'worktree')
    const userInstall = join(home, '.claude', 'plugins', 'cache', 'compound', '3.13.1')
    const projectInstall = join(home, '.claude', 'plugins', 'cache', 'compound', '3.14.3')
    const pluginId = 'compound-engineering@compound-engineering-plugin'
    await mkdir(join(userInstall, 'skills', 'old-plan'), { recursive: true })
    await mkdir(join(projectInstall, 'skills', 'ce-plan'), { recursive: true })
    await mkdir(join(home, '.claude', 'plugins'), { recursive: true })
    await mkdir(cwd, { recursive: true })
    await writeFile(join(userInstall, 'skills', 'old-plan', 'SKILL.md'), '# old-plan')
    await writeFile(
      join(projectInstall, 'skills', 'ce-plan', 'SKILL.md'),
      '---\nname: ce-plan\ndescription: Create structured plans.\n---\n'
    )
    await writeFile(
      join(home, '.claude', 'plugins', 'installed_plugins.json'),
      JSON.stringify({
        plugins: {
          [pluginId]: [
            { scope: 'user', installPath: userInstall },
            { scope: 'project', projectPath: project, installPath: projectInstall }
          ]
        }
      })
    )
    await writeFile(
      join(home, '.claude', 'settings.json'),
      JSON.stringify({ enabledPlugins: { [pluginId]: true } })
    )

    const result = await discoverSkills({ homeDir: home, cwd, repos: [] })

    expect(result.skills.map((skill) => skill.name)).toContain('ce-plan')
    expect(result.skills.map((skill) => skill.name)).not.toContain('old-plan')
    const pluginSource = result.sources.find(
      (source) => source.path === join(projectInstall, 'skills')
    )
    expect(pluginSource).toMatchObject({ sourceKind: 'plugin', owner: 'claude', exists: true })
  })

  it('skips Claude plugin discovery when no explicit cwd targets the scan (Settings shape)', async () => {
    const root = await mkdtemp(join(tmpdir(), 'orca-skills-'))
    const home = join(root, 'home')
    const install = join(home, '.claude', 'plugins', 'cache', 'compound', '3.14.3')
    const pluginId = 'compound-engineering@compound-engineering-plugin'
    await mkdir(join(install, 'skills', 'ce-plan'), { recursive: true })
    await writeFile(join(install, 'skills', 'ce-plan', 'SKILL.md'), '# ce-plan')
    await writeFile(
      join(home, '.claude', 'plugins', 'installed_plugins.json'),
      JSON.stringify({ plugins: { [pluginId]: [{ scope: 'user', installPath: install }] } })
    )
    await writeFile(
      join(home, '.claude', 'settings.json'),
      JSON.stringify({ enabledPlugins: { [pluginId]: true } })
    )

    const result = await discoverSkills({ homeDir: home, repos: [], includeCwd: false })

    expect(result.skills.map((skill) => skill.name)).not.toContain('ce-plan')
    expect(result.sources.some((source) => source.id.startsWith('claude-plugin'))).toBe(false)
  })

  it('records every contributing root when symlinked roots dedup to one skill', async () => {
    const root = await mkdtemp(join(tmpdir(), 'orca-skills-'))
    const home = join(root, 'home')
    const codexSkills = join(home, '.codex', 'skills')
    await mkdir(join(codexSkills, 'review'), { recursive: true })
    await writeFile(join(codexSkills, 'review', 'SKILL.md'), '# review')
    await mkdir(join(home, '.agents'), { recursive: true })
    await symlink(
      codexSkills,
      join(home, '.agents', 'skills'),
      process.platform === 'win32' ? 'junction' : 'dir'
    )

    const result = await discoverSkills({ homeDir: home, repos: [], includeCwd: false })

    const reviews = result.skills.filter((skill) => skill.name === 'review')
    expect(reviews).toHaveLength(1)
    expect(reviews[0].rootPaths?.slice().sort()).toEqual(
      [codexSkills, join(home, '.agents', 'skills')].sort()
    )
  })


  it('reports an SSH-backed repository as a remote-repo source instead of dropping it', async () => {
    const root = await mkdtemp(join(tmpdir(), 'orca-skills-'))
    const runtimeRepo = makeRepo('/runtime/repo')
    runtimeRepo.executionHostId = 'runtime:environment-1'
    const repos = [makeRepo('/remote/repo', 'ssh-1'), runtimeRepo]

    const result = await discoverSkills({ homeDir: join(root, 'home'), repos, includeCwd: false })
    const homeOnly = await discoverSkills({
      homeDir: join(root, 'home'),
      repos,
      includeCwd: false,
      sourceKinds: ['home']
    })

    const remoteSources = result.sources.filter((source) => source.skippedReason === 'remote-repo')
    expect(remoteSources).toEqual([
      expect.objectContaining({ path: '/remote/repo', sourceKind: 'repo', exists: false })
    ])
    expect(result.sources.some((source) => source.path.startsWith('/remote/repo/'))).toBe(false)
    expect(homeOnly.sources.some((source) => source.skippedReason === 'remote-repo')).toBe(false)
  })

  it('does not add runtime-owned repository paths to local scan roots', () => {
    const runtimeRepo = makeRepo('/runtime/repo')
    runtimeRepo.executionHostId = 'runtime:environment-1'

    const roots = buildSkillDiscoverySources({
      homeDir: '/home/test',
      cwd: '/workspace/current',
      repos: [runtimeRepo]
    })

    expect(roots.map((root) => root.path.replace(/\\/g, '/'))).not.toContain(
      '/runtime/repo/.agents/skills'
    )
  })

  it('can exclude the implicit cwd without excluding explicit local repositories', () => {
    const defaultRoots = buildSkillDiscoverySources({
      homeDir: '/home/test',
      cwd: '/workspace/current',
      repos: [makeRepo('/workspace/known')]
    })
    const explicitRoots = buildSkillDiscoverySources({
      homeDir: '/home/test',
      cwd: '/workspace/current',
      repos: [makeRepo('/workspace/known')],
      includeCwd: false
    })

    const normalizedDefaultPaths = defaultRoots.map((root) => root.path.replace(/\\/g, '/'))
    const normalizedExplicitPaths = explicitRoots.map((root) => root.path.replace(/\\/g, '/'))
    expect(normalizedDefaultPaths).toContain('/workspace/current/.agents/skills')
    expect(normalizedExplicitPaths).not.toContain('/workspace/current/.agents/skills')
    expect(normalizedExplicitPaths).toContain('/workspace/known/.agents/skills')
  })

  it('discovers skill packages through symlinked skill directories', async () => {
    const root = await mkdtemp(join(tmpdir(), 'orca-skills-'))
    const home = join(root, 'home')
    const realSkill = join(root, 'central-skills', 'orca-cli')
    const linkedSkill = join(home, '.agents', 'skills', 'orca-cli')
    await mkdir(realSkill, { recursive: true })
    await mkdir(join(home, '.agents', 'skills'), { recursive: true })
    await writeFile(join(realSkill, 'SKILL.md'), '# Orca CLI\n\nUse the Orca CLI.')
    await symlink(realSkill, linkedSkill, process.platform === 'win32' ? 'junction' : 'dir')

    const result = await discoverSkills({
      homeDir: home,
      cwd: join(root, 'missing-cwd')
    })

    const skill = result.skills.find((entry) => entry.name === 'Orca CLI')
    expect(skill?.sourceKind).toBe('home')
    expect(skill?.directoryPath).toBe(linkedSkill)
  })


  it('keeps home classification when cwd points at the same directory as home', async () => {
    const root = await mkdtemp(join(tmpdir(), 'orca-skills-'))
    const home = join(root, 'home')
    const skillDir = join(home, '.agents', 'skills', 'orca-cli')
    await mkdir(skillDir, { recursive: true })
    await writeFile(
      join(skillDir, 'SKILL.md'),
      ['---', 'name: orca-cli', 'description: Use the Orca CLI.', '---', ''].join('\n')
    )

    const result = await discoverSkills({
      homeDir: home,
      cwd: home,
      repos: []
    })

    expect(result.skills.filter((entry) => entry.name === 'orca-cli')).toMatchObject([
      {
        sourceKind: 'home',
        sourceLabel: 'Agent skills home',
        directoryPath: skillDir
      }
    ])
  })

  it('does not loop through recursive symlinked skill directories', async () => {
    const root = await mkdtemp(join(tmpdir(), 'orca-skills-'))
    const home = join(root, 'home')
    const skillRoot = join(home, '.agents', 'skills')
    await mkdir(skillRoot, { recursive: true })
    await symlink(
      skillRoot,
      join(skillRoot, 'loop'),
      process.platform === 'win32' ? 'junction' : 'dir'
    )

    const result = await discoverSkills({
      homeDir: home,
      cwd: join(root, 'missing-cwd')
    })

    expect(result.skills).toEqual([])
  })

  it('enforces depth limits for valid child directories whose names start with dot-dot', async () => {
    const root = await mkdtemp(join(tmpdir(), 'orca-skills-'))
    const home = join(root, 'home')
    const deepSkill = join(home, '.agents', 'skills', '..deep', 'a', 'b', 'c', 'd', 'too-deep')
    await mkdir(deepSkill, { recursive: true })
    await writeFile(join(deepSkill, 'SKILL.md'), '# Too Deep\n\nShould not be discovered.')

    const result = await discoverSkills({
      homeDir: home,
      cwd: join(root, 'missing-cwd')
    })

    expect(result.skills.map((skill) => skill.name)).not.toContain('Too Deep')
  })
})
