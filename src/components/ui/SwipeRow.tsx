import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const FADE = '28px'

function mask(left: boolean, right: boolean): React.CSSProperties | undefined {
  if (!left && !right) return undefined
  const img = `linear-gradient(to right, ${left ? 'transparent' : '#000'} 0, #000 ${left ? FADE : '0'}, #000 calc(100% - ${right ? FADE : '0px'}), ${right ? 'transparent' : '#000'} 100%)`
  return { maskImage: img, WebkitMaskImage: img }
}

type SwipeRowProps = {
  children: ReactNode
  /** Classes for the scrolling strip itself (flex, gap, border…). */
  className?: string
  /** Changes when the selected item changes, so it gets scrolled into view. */
  activeKey?: string
  ariaLabel?: string
}

/**
 * A single horizontal row that makes it obvious there's more to swipe to.
 * When the items don't fit, small arrow buttons sit *beside* the strip (never on
 * top of the tabs); the arrow for an end you've reached is dimmed. The selected
 * item is kept in view and a mouse wheel scrolls sideways.
 */
export function SwipeRow({ children, className = '', activeKey, ariaLabel }: SwipeRowProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [state, setState] = useState({ overflow: false, left: false, right: false })

  const measure = useCallback(() => {
    const el = ref.current
    if (!el) return
    const overflow = el.scrollWidth > el.clientWidth + 2
    const next = {
      overflow,
      left: overflow && el.scrollLeft > 2,
      right: overflow && el.scrollLeft + el.clientWidth < el.scrollWidth - 2,
    }
    setState((s) => (s.overflow === next.overflow && s.left === next.left && s.right === next.right ? s : next))
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    Array.from(el.children).forEach((c) => ro.observe(c))
    // Vertical mouse wheel → sideways scroll (desktop users without a trackpad).
    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return
      e.preventDefault()
      el.scrollLeft += e.deltaY
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      ro.disconnect()
      el.removeEventListener('wheel', onWheel)
    }
  }, [measure])

  // When the selection changes, scroll just enough to show the selected tab.
  // Skipped on first render so the row starts at the beginning.
  const firstRun = useRef(true)
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false
      return
    }
    const el = ref.current
    const active = el?.querySelector<HTMLElement>('[aria-selected="true"]')
    if (!el || !active) return
    const pad = 8
    const aLeft = active.offsetLeft - el.offsetLeft
    if (aLeft < el.scrollLeft) el.scrollTo({ left: aLeft - pad, behavior: 'smooth' })
    else if (aLeft + active.offsetWidth > el.scrollLeft + el.clientWidth)
      el.scrollTo({ left: aLeft + active.offsetWidth - el.clientWidth + pad, behavior: 'smooth' })
  }, [activeKey])

  const nudge = (dir: -1 | 1) => {
    const el = ref.current
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.6, behavior: 'smooth' })
  }

  const arrow = (dir: -1 | 1, enabled: boolean) => (
    <button
      type="button"
      aria-label={dir < 0 ? 'Scroll left' : 'Scroll right'}
      disabled={!enabled}
      onClick={() => nudge(dir)}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--text-h)] transition-opacity active:scale-95 disabled:opacity-30"
    >
      {dir < 0 ? <ChevronLeft size={15} /> : <ChevronRight size={15} />}
    </button>
  )

  return (
    <div className="flex max-w-full items-center gap-1.5">
      {state.overflow && arrow(-1, state.left)}
      <div
        ref={ref}
        role="tablist"
        aria-label={ariaLabel}
        onScroll={measure}
        className={`scroll-x-quiet min-w-0 ${className}`}
        // Soft-fade whichever edge has more tabs hidden, so a half-visible tab reads
        // as "keeps going" rather than a broken cut. Mask (not an overlay) so nothing is covered.
        style={mask(state.left, state.right)}
      >
        {children}
      </div>
      {state.overflow && arrow(1, state.right)}
    </div>
  )
}
