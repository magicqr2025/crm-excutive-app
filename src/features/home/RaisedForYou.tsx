import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BellRing, CalendarCheck, CalendarClock, CheckSquare, ChevronRight, type LucideIcon } from 'lucide-react'
import { useRaisedForMe } from '@/api/queries'
import type { CrmRaisedItem, RaiseEntityType } from '@/api/crmApi'
import { timeAgo } from '@/features/notifications/notificationUi'
import { formatDateTime } from '@/lib/dateFormat'

const SHOWN = 3

const ICON: Record<RaiseEntityType, LucideIcon> = { task: CheckSquare, followup: CalendarClock, meeting: CalendarCheck }
const KIND: Record<RaiseEntityType, string> = { task: 'Task', followup: 'Follow-up', meeting: 'Meeting' }

function routeFor(item: CrmRaisedItem): string {
  if (item.entity_type === 'task') return `/tasks/${item.entity_id}`
  if (item.entity_type === 'followup') return `/followups/${item.entity_id}`
  return `/meetings/${item.entity_id}`
}

/** Open items a manager (or whoever created them) flagged as "do this first" for you. Hidden when nothing is raised. */
export function RaisedForYou() {
  const navigate = useNavigate()
  const { data: items = [] } = useRaisedForMe()
  const [showAll, setShowAll] = useState(false)
  if (items.length === 0) return null
  const shown = showAll ? items : items.slice(0, SHOWN)

  return (
    <section role="region" aria-label="Raised for you" className="overflow-hidden rounded-xl border border-[var(--error-border)] bg-[var(--error-bg)]">
      <div className="px-4 py-2.5">
        <p className="flex items-center gap-2 text-[13.5px] font-semibold text-[var(--error)]">
          <BellRing size={15} /> Raised for you
          <span className="rounded-full bg-[var(--error)] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-white">{items.length}</span>
        </p>
        <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">Please do these first — they stay here until they are done.</p>
      </div>
      <ul className="divide-y divide-[var(--error-border)] border-t border-[var(--error-border)]">
        {shown.map((item) => {
          const Icon = ICON[item.entity_type]
          return (
            <li key={item.id}>
              <button type="button" onClick={() => navigate(routeFor(item))} className="flex w-full items-start gap-3 px-4 py-3 text-left">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--error)]">
                  <Icon size={15} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block break-words text-[13.5px] font-semibold text-[var(--text-h)]">{item.title}</span>
                  <span className="mt-0.5 block text-[12px] text-[var(--text-muted)]">
                    {KIND[item.entity_type]} · raised by <span className="font-medium text-[var(--text-h)]">{item.raised_by_name}</span> {timeAgo(item.raised_at)}
                    {item.due_at && <> · due {formatDateTime(item.due_at)}</>}
                  </span>
                  {item.note && <span className="mt-1 block rounded-md bg-[var(--surface)] px-2.5 py-1.5 text-[12.5px] text-[var(--text)]">“{item.note}”</span>}
                </span>
                <ChevronRight size={16} className="mt-1.5 shrink-0 text-[var(--text-muted)]" />
              </button>
            </li>
          )
        })}
      </ul>
      {items.length > SHOWN && (
        <button type="button" onClick={() => setShowAll((v) => !v)} className="w-full border-t border-[var(--error-border)] px-4 py-2 text-center text-[12.5px] font-medium text-[var(--error)]">
          {showAll ? 'Show fewer' : `Show all ${items.length}`}
        </button>
      )}
    </section>
  )
}
