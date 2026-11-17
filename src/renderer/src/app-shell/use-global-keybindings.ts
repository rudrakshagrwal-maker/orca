import { useEffect, useLayoutEffect, useRef } from 'react'

import { keepLastWorkspaceTabOpen } from '@/lib/keep-last-workspace-tab-open'

import { registerAppCommandDispatcher } from '@/lib/app-commands/app-command-dispatch'

import { textFieldClaimsActionKey } from '@/lib/keyboard/text-field-shortcut-policy'

import { useAppStore } from '../store/index'
import { keybindingMatchesAction, type KeybindingActionId } from '../../../shared/keybindings'

import {
  ModifierDoubleTapDetector,
  toModifierDoubleTapEvent
} from '../../../shared/modifier-double-tap-detector'
import { shortcutPlatform } from './app-window-chrome'
import {
  createAppCommandHandlers,
  getKeybindingContext,
  useAppShortcutActions,
  type AppShortcutState,
  type ShortcutDispatchInput
} from './app-command-handlers'
import type { AppChromeLayout } from './use-app-chrome-layout'

import { addAppKeyListener, removeAppKeyListener } from '@/lib/keyboard/app-keyboard-router'
import { textInputOwnsComposition } from '../../../shared/text-input-shortcut-policy'

/** Register window listeners once; each key event reads the latest committed shortcut state through a ref. */
export function useGlobalKeybindings(args: { layout: AppChromeLayout }): void {
  const { layout } = args
  const actions = useAppShortcutActions()
  const keybindings = useAppStore((s) => s.keybindings)
  const terminalShortcutPolicy = useAppStore((s) => s.settings?.terminalShortcutPolicy)

  const shortcutState: Omit<AppShortcutState, 'activeWorktreeId'> = {
    actions,

    keybindings,
    terminalShortcutPolicy,
    workspaceChromeActive: layout.workspaceChromeActive
  }
  const shortcutStateRef = useRef(shortcutState)
  // Mirror committed state before discrete key events; render-phase writes could leak discarded renders.
  useLayoutEffect(() => {
    shortcutStateRef.current = shortcutState
  })

  useEffect(() => {
    const doubleTapDetector = new ModifierDoubleTapDetector()

    // The active worktree is read at dispatch: App deliberately does not re-render on workspace switches.
    const readShortcutState = (): AppShortcutState => ({
      ...shortcutStateRef.current,
      activeWorktreeId: useAppStore.getState().activeWorktreeId
    })
    const unregisterAppCommandDispatcher = registerAppCommandDispatcher((actionId, source) =>
      (
        createAppCommandHandlers(
          readShortcutState(),
          undefined,
          'app',
          source === 'plugin-host'
        ).get(actionId) ?? (() => false)
      )()
    )

    const dispatchShortcutInput = (input: ShortcutDispatchInput): void => {
      const state = readShortcutState()
      const {
        activeWorktreeId,

        keybindings,
        terminalShortcutPolicy
      } = state

      // Other routed owners may run first; never act twice on prevented input.
      if (input.defaultPrevented || input.isComposing || input.key === 'Process') {
        return
      }
      // Let the focused Settings recorder capture shortcuts without executing them.
      if (
        input.target instanceof Element &&
        input.target.closest('[data-shortcut-recorder-active]') !== null
      ) {
        return
      }
      const context = getKeybindingContext(input.target)

      // Main also intercepts browser-guest shortcuts; renderer handlers cover local focus.

      const matchShortcut = (actionId: KeybindingActionId): boolean =>
        keybindingMatchesAction(actionId, input, shortcutPlatform, keybindings, {
          context,
          terminalShortcutPolicy
        })

      // An empty floating workspace has no tab to close, so Cmd/Ctrl+W hides the overlay before other surfaces act.

      // A closed floating panel has no handler; honor maximize by opening it pre-maximized.

      const targetYields = (actionId?: KeybindingActionId): boolean =>
        textFieldClaimsActionKey(input, actionId)
      const matchAppShortcut = (actionId: KeybindingActionId): boolean =>
        matchShortcut(actionId) && !targetYields(actionId)

      // RA: terminal splits own close; app-level Ctrl+W retains the last tab.
      if (
        context !== 'terminal' &&
        activeWorktreeId &&
        matchShortcut('tab.close') &&
        keepLastWorkspaceTabOpen(activeWorktreeId)
      ) {
        input.preventDefault()
        return
      }
      // Reviewed plugin chords beat built-in defaults; in a terminal they follow the terminal shortcut policy like built-ins.

      const handlers = createAppCommandHandlers(state, input, context)
      if (matchAppShortcut('workspace.delete') && handlers.get('workspace.delete')?.()) {
        return
      }
      if (
        matchAppShortcut('sidebar.childWorkspaces.toggle') &&
        handlers.get('sidebar.childWorkspaces.toggle')?.()
      ) {
        return
      }

      for (const actionId of handlers.keys()) {
        if (matchAppShortcut(actionId) && handlers.get(actionId)?.()) {
          return
        }
      }

      // Run this unbound alias after built-ins; claim it only when unsent review notes exist.
    }

    const detectDoubleTap = (e: KeyboardEvent, type: 'keyDown' | 'keyUp') => {
      if (textInputOwnsComposition(e)) {
        doubleTapDetector.reset()
        return null
      }
      return doubleTapDetector.process(
        toModifierDoubleTapEvent({
          type,
          code: e.code,
          key: e.key,
          shift: e.shiftKey,
          control: e.ctrlKey,
          alt: e.altKey,
          meta: e.metaKey,
          isAutoRepeat: e.repeat
        }),
        Date.now()
      )
    }
    const onKeyDown = (e: KeyboardEvent): void => {
      const detected = detectDoubleTap(e, 'keyDown')
      if (e.repeat) {
        return
      }
      if (detected) {
        // No key/modifier flags: synthetic input matches only DoubleTap bindings.
        dispatchShortcutInput({
          isComposing: e.isComposing,
          altGraph: e.getModifierState('AltGraph'),
          doubleTapModifier: detected.modifier,
          target: e.target,
          defaultPrevented: e.defaultPrevented,
          preventDefault: () => e.preventDefault()
        })
        return
      }
      dispatchShortcutInput({
        isComposing: e.isComposing,
        altGraph: e.getModifierState('AltGraph'),
        key: e.key,
        code: e.code,
        altKey: e.altKey,
        metaKey: e.metaKey,
        ctrlKey: e.ctrlKey,
        shiftKey: e.shiftKey,
        target: e.target,
        defaultPrevented: e.defaultPrevented,
        preventDefault: () => e.preventDefault()
      })
    }

    const onKeyUp = (e: KeyboardEvent): void => {
      detectDoubleTap(e, 'keyUp')
    }

    // Blur must disarm an unfinished gesture.
    const onBlur = (): void => doubleTapDetector.reset()

    addAppKeyListener('keydown', onKeyDown)
    addAppKeyListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      unregisterAppCommandDispatcher()
      removeAppKeyListener('keydown', onKeyDown)
      removeAppKeyListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [])
}
