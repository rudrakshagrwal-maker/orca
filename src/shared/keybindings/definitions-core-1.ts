// definitions.ts concatenates core-1..4 in palette order; slices follow line limits, so thematic regrouping would reorder commands.
import type { KeybindingDefinition } from './types'
import { platformBindings } from './definitions-support'

export const KEYBINDING_DEFINITION_CORE_1: readonly KeybindingDefinition[] = [
  {
    id: 'worktree.quickOpen',
    title: 'Go to File',
    group: 'Global',
    scope: 'global',
    searchKeywords: ['shortcut', 'global', 'file', 'quick open'],
    defaultBindings: platformBindings(['Mod+P'])
  },
  {
    id: 'app.settings',
    title: 'Open Settings',
    group: 'Global',
    scope: 'global',
    searchKeywords: ['shortcut', 'settings', 'preferences'],
    // Leave Cmd/Ctrl+, to terminal apps such as Codex unless the user opts in.
    defaultBindings: platformBindings([]),
    conflictGroup: 'menu'
  },
  {
    id: 'app.forceReload',
    title: 'Force Reload',
    group: 'Global',
    scope: 'global',
    searchKeywords: ['shortcut', 'reload', 'refresh', 'force'],
    defaultBindings: platformBindings(['Mod+Shift+R']),
    conflictGroup: 'menu'
  },

  {
    id: 'worktree.navigateUp',
    title: 'Previous worktree',
    group: 'Global',
    scope: 'global',
    searchKeywords: ['shortcut', 'global', 'worktree', 'previous', 'up'],
    defaultBindings: platformBindings(['Mod+Shift+ArrowUp']),
    // Why: default Mod+Shift+Up is the field's select-to-start.
    allowInTextField: 'non-default-chords'
  },
  {
    id: 'worktree.navigateDown',
    title: 'Next worktree',
    group: 'Global',
    scope: 'global',
    searchKeywords: ['shortcut', 'global', 'worktree', 'next', 'down'],
    defaultBindings: platformBindings(['Mod+Shift+ArrowDown']),
    // Why: default Mod+Shift+Down is the field's select-to-end.
    allowInTextField: 'non-default-chords'
  },
  {
    id: 'workspace.create',
    title: 'Create worktree',
    group: 'Global',
    scope: 'global',
    searchKeywords: ['shortcut', 'global', 'worktree', 'create', 'new workspace'],
    // RA: Windows keeps one default per action; every action remains remappable.
    defaultBindings: { ...platformBindings(['Mod+N', 'Mod+Shift+N']), win32: ['Mod+N'] }
  },
  {
    id: 'workspace.rename',
    title: 'Rename worktree',
    group: 'Global',
    scope: 'global',
    conflictGroup: 'workspace-shell',
    searchKeywords: ['shortcut', 'global', 'worktree', 'rename', 'workspace', 'title'],
    // Why: macOS only — Windows/Linux Ctrl+Alt+R has no safe default (Ctrl+R reverse-search, Ctrl+Shift+R reload are taken).
    defaultBindings: {
      darwin: ['Mod+Alt+R'],
      linux: [],
      win32: []
    }
  },
  {
    id: 'workspace.delete',
    title: 'Delete Workspace',
    group: 'Global',
    scope: 'global',
    searchKeywords: [
      'shortcut',
      'global',
      'workspace',
      'current workspace',
      'worktree',
      'delete',
      'remove',
      'trash'
    ],
    // Why: Backspace avoids the terminal pane's D-based split shortcuts on every platform.
    defaultBindings: platformBindings(['Mod+Shift+Backspace']),
    allowInTerminal: true
  },

  {
    id: 'dashboard.toggle',
    title: 'Toggle Agent Dashboard',
    group: 'Global',
    scope: 'global',
    searchKeywords: [
      'shortcut',
      'global',
      'agent',
      'agents',
      'dashboard',
      'kanban',
      'board',
      'toggle',
      'open',
      'close'
    ],
    // Experimental surfaces stay unbound rather than claim terminal users’ global chords, matching workspace.openBoard.
    defaultBindings: platformBindings([]),
    allowInTerminal: true
  },
  {
    id: 'workspace.selectByIndex',
    title: 'Select Workspace 1–9',
    group: 'Global',
    scope: 'global',
    searchKeywords: [
      'shortcut',
      'global',
      'workspace',
      'worktree',
      'select',
      'switch',
      'number',
      'digit',
      '1-9',
      'index'
    ],
    // Why: one remappable row covers the whole 1-9 range (stored chord is a representative; any of 1-9 fires it).
    // RA: Windows reserves Ctrl+1-9 for tabs, matching Chrome.
    defaultBindings: { darwin: ['Mod+1'], linux: ['Mod+1'], win32: ['Alt+1'] }
  },
  {
    id: 'voice.dictation',
    title: 'Dictation',
    group: 'Global',
    scope: 'global',
    searchKeywords: ['shortcut', 'dictation', 'voice', 'speech', 'microphone'],
    defaultBindings: platformBindings(['Mod+E'])
  },

  {
    id: 'sidebar.left.toggle',
    title: 'Toggle Sidebar',
    group: 'Global',
    scope: 'global',
    searchKeywords: ['shortcut', 'sidebar', 'left'],
    defaultBindings: platformBindings(['Mod+B'])
  },

  {
    id: 'sidebar.sleepingWorkspaces.toggle',
    title: 'Toggle Sleeping Workspaces',
    group: 'Global',
    scope: 'global',
    searchKeywords: [
      'shortcut',
      'sidebar',
      'sleeping',
      'asleep',
      'workspaces',
      'worktree',
      'filter',
      'show',
      'hide'
    ],
    // Why: ship unbound (issue #5209 asks users to assign it), avoiding a claimed cross-platform chord.
    defaultBindings: platformBindings([])
  },
  {
    id: 'sidebar.focusWorktreeList',
    title: 'Focus worktree list',
    group: 'Global',
    scope: 'global',
    searchKeywords: ['shortcut', 'sidebar', 'worktree', 'focus'],
    // Why: keep zoom.reset on the browser-standard Mod+0; this chord was unreachable while it shared that default (#8584).
    defaultBindings: platformBindings(['Mod+Shift+0'])
  }
]
