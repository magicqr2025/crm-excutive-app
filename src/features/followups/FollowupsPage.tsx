import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { SearchBox } from '@/components/ui/SearchBox'
import { InfiniteScrollFooter } from '@/components/ui/InfiniteScrollFooter'
import { useAuthStore } from '@/store/useAuthStore'
import { useMyActiveFollowupsPage } from '@/api/queries'
import { STATUS_LABEL, STATUS_TONE, formatDate, formatTime } from '@/lib/followupFormat'

export { STATUS_LABEL, STATUS_TONE, formatDate, formatTime }

export function FollowupsPage() {
  const navigate = useNavigate()
  const userId = useAuthStore((s) => s.user?.id ?? '')
  const [search, setSearch] = useState('')
  const { items: followups, total, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } = useMyActiveFollowupsPage(userId, search)

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[var(--surface)]">
      <PageHeader title="Follow-ups" subtitle="Leads due for a follow-up, assigned to you." />
      <div className="space-y-4 p-4">
        <SearchBox value={search} onSubmit={setSearch} placeholder="Search by name or phone…" />
        {search && !isLoading && (
          <p className="text-[12px] text-[var(--text-muted)]">
            {total} {total === 1 ? 'result' : 'results'} for “{search}”
          </p>
        )}
        {isLoading ? (
          <p className="text-[13px] text-[var(--text-muted)]">Loading…</p>
        ) : followups.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-[var(--text-muted)]">{search ? `No results for “${search}”.` : 'No follow-ups due.'}</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {followups.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => navigate(`/followups/${f.id}`)}
                className="rounded-xl border border-[var(--border)] p-3.5 text-left hover:bg-[var(--surface-hover)]"
              >
                <div className="flex items-center gap-2.5">
                  <Avatar name={f.contact_name ?? 'Unknown'} size={32} />
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-[var(--text-h)]">{f.contact_name ?? 'Unknown'}</p>
                    <p className="text-[12px] text-[var(--text-muted)]">{f.contact_phone ?? '—'}</p>
                  </div>
                </div>
                <p className="mt-2.5 font-mono-num text-[12px] text-[var(--text-muted)]">
                  Due {formatDate(f.followup_date)} · {formatTime(f.followup_time)}
                </p>
                <div className="mt-2">
                  <Badge tone={STATUS_TONE[f.followup_status]}>{STATUS_LABEL[f.followup_status]}</Badge>
                </div>
              </button>
            ))}
          </div>
        )}
        <InfiniteScrollFooter hasNextPage={Boolean(hasNextPage)} isFetchingNextPage={isFetchingNextPage} onLoadMore={() => void fetchNextPage()} />
      </div>
    </div>
  )
}
