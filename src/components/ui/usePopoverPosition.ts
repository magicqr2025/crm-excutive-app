import { type RefObject, useLayoutEffect, useState } from 'react'

interface Position {
  top: number
  left: number
  placement: 'bottom' | 'top'
}

export function usePopoverPosition(
  anchorRef: RefObject<HTMLElement | null>,
  panelRef: RefObject<HTMLElement | null>,
  open: boolean,
  align: 'start' | 'end' = 'start',
) {
  const [position, setPosition] = useState<Position | null>(null)

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null)
      return
    }
    const anchor = anchorRef.current
    const panel = panelRef.current
    if (!anchor || !panel) return

    const anchorRect = anchor.getBoundingClientRect()
    const panelRect = panel.getBoundingClientRect()
    const viewportH = window.innerHeight
    const viewportW = window.innerWidth

    const spaceBelow = viewportH - anchorRect.bottom
    const placement: Position['placement'] = spaceBelow < panelRect.height + 8 && anchorRect.top > panelRect.height + 8 ? 'top' : 'bottom'

    const top = placement === 'bottom' ? anchorRect.bottom + 6 : anchorRect.top - panelRect.height - 6

    let left = align === 'end' ? anchorRect.right - panelRect.width : anchorRect.left
    left = Math.min(Math.max(8, left), viewportW - panelRect.width - 8)

    setPosition({ top, left, placement })
  }, [open, anchorRef, panelRef, align])

  return position
}
