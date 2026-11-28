import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Bell, CalendarCheck, ChevronRight, Handshake, IndianRupee, MessageCircle, Pencil, PhoneCall, Target, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import type { CrmMyPerformance } from '@/api/crmApi'
import { Kpi } from '@/features/performance/PerformanceParts'
import { pct, rupees } from '@/features/performance/performanceUtils'
import { TeamHeader } from '@/features/team/teamParts'
import { TargetDialog, type TargetSubject } from './TargetDialog'
import { TeamActivitySection } from './TeamActivitySection'
import { TeamChatsList } from './TeamChatsList'
import { useTeamChats, useTeamPerformance } from './reportQueries'
import { AchievedBar, MonthSwitcher, QueryState } from './reportParts'
import { chipClass } from './reportStyles'
import { targetFigures } from './targetMath'
import { monthFromParams } from './reportMonth'

type View = 'activity' | 'salary' | 'chats'

const VIEWS: { value: View; label: string }[] = [
  { value: 'activity', label: 'Activity' },
  { value: 'salary', label: 'Salary & target' },
  { value: 'chats', label: 'WhatsApp chats' },
]

const SORTS = {
  collected: { label: 'Sales collected', value: (s: CrmMyPerformance) => s.collected },
  calls: { label: 'Calls', value: (s: CrmMyPerformance) => s.calls.total },
  meetings: { label: 'Meetings attended', value: (s: CrmMyPerformance) => s.meetings.attended },
  leads: { label: 'New leads', value: (s: CrmMyPerformance) => s.leads.new_this_month },
}
type SortKey = keyof typeof SORTS

function Figures({ items }: { items: { label: string; value: string | number; tone?: 'error' }[] }) {
  return (
    <dl className="grid grid-cols-3 gap-2">
      {items.map((i) => (
        <div key={i.label} className="min-w-0 rounded-lg bg-[var(--surface-hover)] px-2 py-1.5">
          <dd className={cn('truncate font-mono-num text-[14px] font-semibold', i.tone === 'error' ? 'text-[var(--error)]' : 'text-[var(--text-h)]')}>{i.value}</dd>
          <dt className="truncate text-[11px] text-[var(--text-muted)]">{i.label}</dt>
        </div>
      ))}
    </dl>
  )
}

export function TeamPerformancePage() {
  // The month and view live in the address, so coming back from a staff page keeps them.
  const [params, setParams] = useSearchParams()
  const { month, year } = monthFromParams(params)
  const view: View = VIEWS.find((v) => v.value === params.get('view'))?.value ?? 'activity'
  const [sort, setSort] = useState<SortKey>('collected')
  const [editing, setEditing] = useState<TargetSubject | null>(null)
  const query = useTeamPerformance(month, year)
  const chats = useTeamChats(true)

  const setQuery = (next: Record<string, string>) => setParams((p) => ({ ...Object.fromEntries(p), ...next }), { replace: true })

  const staff = [...(query.data?.staff ?? [])].sort((a, b) => SORTS[sort].value(b) - SORTS[sort].value(a) || a.name.localeCompare(b.name))
  const sum = (pick: (s: CrmMyPerformance) => number) => staff.reduce((total, s) => total + pick(s), 0)
  const calls = sum((s) => s.calls.total)
  const collected = sum((s) => s.collected)
  const target = sum((s) => s.target?.target_amount ?? 0)
  const overdue = sum((s) => s.followups.overdue)
  const deals = sum((s) => s.deals.count)

  const edit = (s: CrmMyPerformance) => setEditing({ staffId: s.staff_id, name: s.name, month, year, collected: s.collected, current: s.target })

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <TeamHeader title="Team Performance" subtitle="How your team is doing this month." backTo="/admin" />
      <div className="mx-auto w-full max-w-5xl space-y-4 px-4 pb-10 pt-4 md:px-6">
        <div className="flex justify-center sm:justify-end">
          <MonthSwitcher month={month} year={year} onChange={(m, y) => setQuery({ month: String(m), year: String(y) })} />
        </div>

        <QueryState query={query} empty={query.data && staff.length === 0 ? 'No active staff yet. Add staff to see their performance.' : null}>
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
            <Kpi icon={UserPlus} label="New leads" value={sum((s) => s.leads.new_this_month).toLocaleString()} />
            <Kpi icon={PhoneCall} label="Calls" value={calls.toLocaleString()} sub={`${pct(sum((s) => s.calls.connected), calls)}% connected`} />
            <Kpi icon={CalendarCheck} label="Meetings attended" value={sum((s) => s.meetings.attended).toLocaleString()} sub={`${sum((s) => s.meetings.upcoming)} upcoming`} />
            <Kpi icon={Bell} label="Follow-ups overdue" value={overdue.toLocaleString()} tone={overdue > 0 ? 'error' : undefined} sub="right now" />
            <Kpi icon={Handshake} label="Deals booked" value={rupees(sum((s) => s.deals.booked_amount))} sub={`${deals} deal${deals === 1 ? '' : 's'}`} />
            <Kpi icon={IndianRupee} label="Sales collected" value={rupees(collected)} tone="success" sub={target > 0 ? `${pct(collected, target)}% of ${rupees(target)} target` : 'No targets set'} />
            <Kpi
              icon={MessageCircle}
              label="WhatsApp chats open"
              value={(chats.data?.total ?? 0).toLocaleString()}
              sub={chats.data?.waiting_on_us ? `${chats.data.waiting_on_us} waiting on us` : 'Tap to view'}
              tone={chats.data?.waiting_on_us ? 'warning' : undefined}
              onClick={() => setQuery({ view: 'chats' })}
              active={view === 'chats'}
            />
          </div>

          <div role="tablist" className="scrollbar-thin flex gap-1.5 overflow-x-auto pb-1">
            {VIEWS.map((v) => (
              <button key={v.value} type="button" role="tab" aria-selected={view === v.value} onClick={() => setQuery({ view: v.value })} className={chipClass(view === v.value)}>
                {v.label}
              </button>
            ))}
          </div>

          {view === 'chats' ? (
            <TeamChatsList />
          ) : (
            <>
              <label className="flex items-center justify-end gap-2 text-[12.5px] text-[var(--text-muted)]">
                Sort by
                <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="h-10 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-[13px] text-[var(--text-h)]">
                  {Object.entries(SORTS).map(([key, s]) => (
                    <option key={key} value={key}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>

              <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {staff.map((s) => {
                  const figures = s.target ? targetFigures(s.target.base_salary, s.target.target_amount, s.collected, s.target.incentive_slab ?? []) : null
                  return (
                    <li key={s.staff_id} className="flex flex-col gap-3 rounded-2xl bg-[var(--surface)] p-3.5 ring-1 ring-[var(--border)]">
                      <Link
                        to={`/admin/performance/${s.staff_id}?month=${month}&year=${year}${view === 'salary' ? '&tab=achievements' : ''}`}
                        className="flex min-h-9 items-center gap-2 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                      >
                        <span className="min-w-0 flex-1 truncate text-[14.5px] font-semibold text-[var(--text-h)]">{s.name}</span>
                        <span className="text-[12px] font-medium text-[var(--accent-strong)]">Details</span>
                        <ChevronRight size={16} aria-hidden className="shrink-0 text-[var(--accent-strong)]" />
                      </Link>

                      {view === 'activity' ? (
                        <Figures
                          items={[
                            { label: 'New leads', value: s.leads.new_this_month },
                            { label: 'Calls', value: s.calls.total },
                            { label: 'Meetings', value: s.meetings.attended },
                          ]}
                        />
                      ) : (
                        <>
                          <AchievedBar collected={s.collected} target={s.target?.target_amount ?? null} />
                          <Figures
                            items={[
                              { label: 'Base salary', value: s.target ? rupees(s.target.base_salary) : '—' },
                              { label: 'Target', value: s.target ? rupees(s.target.target_amount) : '—' },
                              { label: 'Collected', value: rupees(s.collected) },
                              { label: 'Booked', value: rupees(s.deals.booked_amount) },
                              { label: 'Pending', value: rupees(s.deals.pending_amount) },
                              { label: 'Incentive', value: figures ? rupees(figures.incentive) : '—' },
                              { label: 'Final salary', value: figures ? rupees(figures.finalSalary) : '—' },
                              { label: 'Target left', value: figures ? rupees(figures.due) : '—', tone: figures && figures.due > 0 ? 'error' : undefined },
                            ]}
                          />
                          {s.collected_from_earlier_months > 0 && (
                            <p className="text-[11.5px] text-[var(--text-muted)]">Collected includes {rupees(s.collected_from_earlier_months)} from earlier months’ deals.</p>
                          )}
                          {s.target?.carried_forward && <p className="text-[11.5px] text-[var(--text-muted)]">Target carried forward from an earlier month.</p>}
                          <Button variant="outline" className="mt-auto justify-center" onClick={() => edit(s)}>
                            {s.target ? <Pencil size={14} /> : <Target size={14} />}
                            {s.target ? 'Edit target' : 'Set target'}
                          </Button>
                        </>
                      )}
                    </li>
                  )
                })}
              </ul>

              <p className="text-[12px] text-[var(--text-muted)]">
                Sales collected is money received that month, after refunds. Targets and incentives use it.
              </p>
              <div className="border-t border-[var(--border)] pt-5">
                <TeamActivitySection />
              </div>
            </>
          )}
        </QueryState>
      </div>
      {editing && <TargetDialog subject={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
