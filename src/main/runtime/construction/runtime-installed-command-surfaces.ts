// RA: Remove unused surfaces and their startup dependencies from the lean fork.
import type { RuntimeEdgeCommandSurface } from './runtime-edge-command-controller'

import type { RuntimeFileCommandSurface } from './runtime-file-command-surface'
import type { RuntimeGitCommandSurface } from '../integrations/git/runtime-git-command-surface'
import type { RuntimeRepositoryCommandSurface } from '../repositories/runtime-repository-command-surface'

import type { RuntimeServiceCommandSurface } from './runtime-service-command-surface'
import type { RuntimeSkillCommandSurface } from '../integrations/skill/runtime-skill-command-contract'

type RuntimeInstalledCommandSurfaces = RuntimeEdgeCommandSurface &
  RuntimeFileCommandSurface &
  RuntimeGitCommandSurface &
  RuntimeRepositoryCommandSurface &
  RuntimeServiceCommandSurface &
  RuntimeSkillCommandSurface

export type RuntimeCommandSurfaceHost<T> = T & RuntimeInstalledCommandSurfaces
