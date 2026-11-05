// RA: Right Ctrl+Arrow moves between panes; Left Ctrl+Arrow stays word-jump in the shell.
// KeyboardEvent on the arrow key cannot tell which Ctrl is down, so track the Control key itself.
let rightCtrlHeld = false

export function isRightCtrlHeld(): boolean {
  return rightCtrlHeld
}

export function setRightCtrlHeldForTest(held: boolean): void {
  rightCtrlHeld = held
}

if (typeof window !== 'undefined') {
  const track = (event: KeyboardEvent): void => {
    if (event.code === 'ControlRight') {
      rightCtrlHeld = event.type === 'keydown'
    } else if (!event.ctrlKey) {
      // Why: a keyup lost to another window or a dialog would leave the flag stuck on.
      rightCtrlHeld = false
    }
  }
  window.addEventListener('keydown', track, true)
  window.addEventListener('keyup', track, true)
  window.addEventListener('blur', () => {
    rightCtrlHeld = false
  })
}
