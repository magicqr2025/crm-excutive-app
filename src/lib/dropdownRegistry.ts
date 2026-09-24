// Shared registry so any open dropdown/menu/popover auto-closes when a
// different one opens, instead of relying solely on outside-click detection.
let activeClose: (() => void) | null = null

export function registerDropdownOpen(close: () => void) {
  if (activeClose && activeClose !== close) {
    activeClose()
  }
  activeClose = close
}

export function unregisterDropdownOpen(close: () => void) {
  if (activeClose === close) activeClose = null
}
