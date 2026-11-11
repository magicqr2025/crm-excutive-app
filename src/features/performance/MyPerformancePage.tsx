import { useMemo, useState } from 'react'
import { Input } from '@/components/ui/Input'
import { PageHeader } from '@/components/layout/PageHeader'
import type { PerformancePeriod } from '@/api/crmApi'
import { cn } from '@/lib/utils'
import { ActivityTab } from './ActivityTab'
import { AchievementsTab } from './AchievementsTab'
import { ChatsTab } from './ChatsTab'
import { InteractionsTab } from './InteractionsTab'
import { monthOptions, rangeForAllMonths, rangeForMonth, rangeForPreset, toDay } from './performanceUtils'

type TabId = 'interactions' | 'achievements' | 'whatsapp' | 'activity'

const TABS: { value: TabId; label: string }[] = [
  { value: 'interactions', label: 'Client Interactions' },
  { value: 'achievements', label: 'Monthly Achievements' },
  { value: 'whatsapp', label: 'WhatsApp Chats' },
  { value: 'activity', label: 'Activity' },
]

// Inside the chosen month: the whole month, a quick range, or exact days.
type Sub = 'month' | 'today' | 'yesterday' | 'week' | 'custom'

const rangeLabel = ({ from, to }: { from: string; to: string }) => {
  const fmt = (s: string) => new Date(`${s}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
  return from === to ? fmt(from) : `${fmt(from)} – ${fmt(to)}`
}

const chipClass = (active: boolean) =>
  cn(
    'h-8 shrink-0 whitespace-nowrap rounded-full border px-3 text-[12.5px] font-medium transition-colors',
    active
      ? 'border-[var(--accent)] bg-[var(--accent-bg)] text-[var(--accent-strong)]'
      : 'border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-h)]',
  )

/**
 * The signed-in staff member's own numbers, laid out like the admin app's staff page: client interactions,
 * monthly achievements (target, pay, deals, payments) and open WhatsApp chats — plus an activity summary.
 */
export function MyPerformancePage() {
  const months = useMemo(() => monthOptions(), [])
  const [tab, setTab] = useState<TabId>('interactions')
  // 'YYYY-MM', or 'all' for the last 12 months added together.
  const [monthKey, setMonthKey] = useState(months[0].value)
  const [sub, setSub] = useState<Sub>('month')
  const today = toDay(new Date())
  const [custom, setCustom] = useState({ from: today, to: today })

  const isAll = monthKey === 'all'
  // Achievements are always one calendar month; "all months" shows the current one there.
  const achievementsKey = isAll ? months[0].value : monthKey
  const [achYear, achMonth] = achievementsKey.split('-').map(Number)
  const monthName = (key: string) => months.find((m) => m.value === key)?.label ?? key
  const wholeLabel = isAll ? 'All months' : `Whole ${new Date(achYear, achMonth - 1, 1).toLocaleDateString(undefined, { month: 'long' })}`

  // Computed once per choice: a fresh Date on every render would change the query key and refetch forever.
  const range = useMemo(() => {
    if (sub === 'today') return rangeForPreset('today')
    if (sub === 'yesterday') return rangeForPreset('yesterday')
    if (sub === 'week') return rangeForPreset('7d')
    if (sub === 'custom') return custom.from && custom.to && custom.from <= custom.to ? custom : rangeForMonth(achievementsKey)
    return isAll ? rangeForAllMonths() : rangeForMonth(monthKey)
  }, [sub, custom, monthKey, isAll, achievementsKey])

  // A whole month asks by month so meetings later in it still count; everything else asks by day range.
  const period: PerformancePeriod = sub === 'month' && !isAll ? { month: achMonth, year: achYear } : range
  const periodLabel = sub === 'month' ? (isAll ? 'the last 12 months' : monthName(monthKey)) : rangeLabel(range)

  const chips: { value: Sub; label: string }[] = [
    { value: 'month', label: wholeLabel },
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: 'week', label: 'Last 7 days' },
    { value: 'custom', label: 'Custom' },
  ]

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <PageHeader
        title="My Performance"
        subtitle={tab === 'achievements' ? monthName(achievementsKey) : periodLabel}
        action={
          <select
            aria-label="Month"
            value={monthKey}
            onChange={(e) => {
              setMonthKey(e.target.value)
              setSub('month')
            }}
            className="h-9 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 text-[13px] font-medium text-[var(--text-h)] outline-none focus:border-[var(--accent)]"
          >
            <option value="all">All months (last 12)</option>
            {months.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        }
      />

      <div className="scrollbar-thin flex shrink-0 gap-1 overflow-x-auto border-b border-[var(--border)] px-4 md:px-6" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={tab === t.value}
            onClick={() => setTab(t.value)}
            className={cn(
              '-mb-px shrink-0 border-b-2 px-3 py-2.5 text-[13px] font-medium transition-colors',
              tab === t.value ? 'border-[var(--accent)] text-[var(--text-h)]' : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-h)]',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mx-auto w-full max-w-4xl space-y-3 px-4 pb-8 pt-4 md:px-6">
        {(tab === 'interactions' || tab === 'activity') && (
          <div className="space-y-2">
            <div className="scrollbar-thin -mx-4 flex items-center gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
              <span className="mr-1 shrink-0 text-[12.5px] font-medium text-[var(--text-muted)]">Period</span>
              {chips.map((c) => (
                <button key={c.value} type="button" onClick={() => setSub(c.value)} className={chipClass(sub === c.value)}>
                  {c.label}
                </button>
              ))}
            </div>
            {sub === 'custom' && (
              <div className="flex flex-wrap items-center gap-2">
                {(['from', 'to'] as const).map((k, i) => (
                  <span key={k} className="flex items-center gap-2">
                    {i === 1 && <span className="text-[12px] text-[var(--text-muted)]">to</span>}
                    <Input
                      type="date"
                      aria-label={k === 'from' ? 'From' : 'To'}
                      value={custom[k]}
                      // Nothing to report for days that haven't happened yet.
                      max={k === 'from' && custom.to && custom.to < today ? custom.to : today}
                      min={k === 'to' ? custom.from || undefined : undefined}
                      onChange={(e) => setCustom((c) => ({ ...c, [k]: e.target.value > today ? today : e.target.value }))}
                      className="h-8 w-36 px-2 pr-8 text-[12.5px]"
                    />
                  </span>
                ))}
                {!(custom.from && custom.to && custom.from <= custom.to) && (
                  <span className="text-[12px] text-[var(--error)]">Pick a start day on or before the end day.</span>
                )}
              </div>
            )}
          </div>
        )}

        {tab === 'interactions' && <InteractionsTab period={period} periodLabel={periodLabel} onOpenSales={() => setTab('achievements')} />}
        {tab === 'achievements' && (
          <>
            {isAll && <p className="text-[12px] text-[var(--text-muted)]">Targets are per month, so this shows {monthName(achievementsKey)}. Pick a month above to see another.</p>}
            <AchievementsTab month={achMonth} year={achYear} monthLabel={monthName(achievementsKey)} />
          </>
        )}
        {tab === 'whatsapp' && <ChatsTab />}
        {tab === 'activity' && <ActivityTab range={range} />}
      </div>
    </div>
  )
}
