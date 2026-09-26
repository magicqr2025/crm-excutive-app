import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { SearchBox } from '@/components/ui/SearchBox'
import { InfiniteScrollFooter } from '@/components/ui/InfiniteScrollFooter'
import { useToast } from '@/components/ui/useToast'
import { useAuthStore } from '@/store/useAuthStore'
import { useMarkFollowupDone, useMyFollowupsTabPage, useOverdueFollowupCount } from '@/api/queries'
import type { FollowupTab } from '@/api/crmApi'
import { STATUS_LABEL, STATUS_TONE, formatDate, formatTime } from '@/lib/followupFormat'

export { STATUS_LABEL, STATUS_TONE, formatDate, formatTime }

const TABS: { value: FollowupTab; label: string }[] = [
  { value: 'overdue', label: 'Overdue' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'done', label: 'Done' },
]

const SUBTITLES: Record<FollowupTab, string> = {
  overdue: 'Past their due date and not done yet — oldest first.',
  upcoming: 'Due today or later — soonest first.',
  done: 'Completed follow-ups — most recent first.',
}

const EMPTY: Record<FollowupTab, string> = {
  overdue: 'Nothing overdue. 🎉',
  upcoming: 'No upcoming follow-ups.',
  done: 'No completed follow-ups yet.',
}

export function FollowupsPage() {
  const navigate = useNavigate()
  const { show } = useToast()
  const userId = useAuthStore((s) => s.user?.id ?? '')
  const [tab, setTab] = useState<FollowupTab>('upcoming')
  const [search, setSearch] = useState('')
  const { items: followups, total, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } = useMyFollowupsTabPage(userId, tab, search)
  const { data: overdueCount = 0 } = useOverdueFollowupCount(userId)
  const markDone = useMarkFollowupDone()

  function done(id: string) {
    markDone.mutate(id, {
      onSuccess: () => show({ title: 'Follow-up marked done', tone: 'success' }),
      onError: (err) => show({ title: err instanceof Error ? err.message : 'Could not mark it done', tone: 'error' }),
    })
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[var(--surface)]">
      <PageHeader title="Follow-ups" subtitle={SUBTITLES[tab]} />
      <div className="space-y-4 p-4">
        <div className="flex items-center gap-1 self-start rounded-lg border border-[var(--border)] p-1" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.value}
              role="tab"
              aria-selected={tab === t.value}
              onClick={() => setTab(t.value)}
              className={
                tab === t.value
                  ? 'flex items-center gap-1.5 rounded-md bg-[var(--accent)] px-3 py-1.5 text-[12.5px] font-medium text-[var(--ink)]'
                  : 'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] font-medium text-[var(--text-muted)] hover:bg-[var(--surface-hover)]'
              }
            >
              {t.label}
              {t.value === 'overdue' && overdueCount > 0 && (
                <span className="rounded-full bg-[var(--error)] px-1.5 text-[11px] font-semibold leading-4 text-white">{overdueCount}</span>
              )}
            </button>
          ))}
        </div>
        <SearchBox value={search} onSubmit={setSearch} placeholder="Search by name or phone…" />
        {search && !isLoading && (
          <p className="text-[12px] text-[var(--text-muted)]">
            {total} {total === 1 ? 'result' : 'results'} for “{search}”
          </p>
        )}
        {isLoading ? (
          <p className="text-[13px] text-[var(--text-muted)]">Loading…</p>
        ) : followups.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-[var(--text-muted)]">{search ? `No results for “${search}”.` : EMPTY[tab]}</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {followups.map((f) => (
              <div
                key={f.id}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/followups/${f.id}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') navigate(`/followups/${f.id}`)
                }}
                className={`cursor-pointer rounded-xl border p-3.5 text-left hover:bg-[var(--surface-hover)] ${tab === 'overdue' ? 'border-[var(--error)]' : 'border-[var(--border)]'}`}
              >
                <div className="flex items-center gap-2.5">
                  <Avatar name={f.contact_name ?? 'Unknown'} size={32} />
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-[var(--text-h)]">{f.contact_name ?? 'Unknown'}</p>
                    <p className="text-[12px] text-[var(--text-muted)]">{f.contact_phone ?? '—'}</p>
                  </div>
                </div>
                <p
                  className={`mt-2.5 font-mono-num text-[12px] ${tab === 'overdue' ? 'font-semibold text-[var(--error)]' : 'text-[var(--text-muted)]'}`}
                >
                  Due {formatDate(f.followup_date)} · {formatTime(f.followup_time)}
                </p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  {tab === 'overdue' ? <Badge tone="error">Overdue</Badge> : <Badge tone={STATUS_TONE[f.followup_status]}>{STATUS_LABEL[f.followup_status]}</Badge>}
                  {tab !== 'done' && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={markDone.isPending}
                      onClick={(e) => {
                        e.stopPropagation()
                        done(f.id)
                      }}
                    >
                      <Check size={13} /> Mark done
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        <InfiniteScrollFooter hasNextPage={Boolean(hasNextPage)} isFetchingNextPage={isFetchingNextPage} onLoadMore={() => void fetchNextPage()} />
      </div>
    </div>
  )
}
