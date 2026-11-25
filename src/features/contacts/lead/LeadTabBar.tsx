import { cn } from '@/lib/utils'
import { LEAD_TAB_LABEL as LABEL, type LeadTab } from './leadConstants'

/** Underlined tabs with counts. Swipes sideways on a phone or tablet in portrait; sticks under the header while scrolling. */
export function LeadTabBar({ tabs, value, onChange, counts }: { tabs: LeadTab[]; value: LeadTab; onChange: (tab: LeadTab) => void; counts: Partial<Record<LeadTab, number>> }) {
  return (
    <div className="sticky top-0 z-10 -mx-3 border-b border-[var(--border)] bg-[var(--bg)]/95 px-3 backdrop-blur sm:-mx-5 sm:px-5 lg:mx-0 lg:px-0">
      <div role="tablist" aria-label="Lead sections" className="scroll-x-quiet flex gap-1">
        {tabs.map((tab) => {
          const active = tab === value
          const count = counts[tab]
          return (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(tab)}
              className={cn(
                'relative flex h-11 shrink-0 items-center gap-1.5 px-3 text-[13.5px] font-medium transition-colors',
                active ? 'text-[var(--text-h)]' : 'text-[var(--text-muted)] hover:text-[var(--text-h)]',
              )}
            >
              {LABEL[tab]}
              {count !== undefined && count > 0 && (
                <span
                  className={cn(
                    'font-mono-num rounded-full px-1.5 text-[11px] leading-[18px]',
                    active ? 'bg-[var(--accent-bg)] text-[var(--accent-strong)]' : 'bg-[var(--surface-hover)] text-[var(--text-muted)]',
                  )}
                >
                  {count}
                </span>
              )}
              {active && <span aria-hidden className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[var(--accent)]" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
