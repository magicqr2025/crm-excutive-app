import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, CheckCheck } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { InfiniteScrollFooter } from '@/components/ui/InfiniteScrollFooter'
import { PageLoader } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/useToast'
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotificationsPage, useUnreadNotificationCount } from '@/api/queries'
import type { CrmNotification } from '@/api/crmApi'
import { cn } from '@/lib/utils'
import { notificationIcon, notificationRoute, timeAgo } from './notificationUi'

type Tab = 'all' | 'unread'

export function NotificationsPage() {
  const navigate = useNavigate()
  const { show } = useToast()
  const [tab, setTab] = useState<Tab>('all')
  const { data: unread = 0 } = useUnreadNotificationCount()
  const { items, isLoading, isError, hasNextPage, isFetchingNextPage, fetchNextPage } = useNotificationsPage(tab === 'unread')
  const markRead = useMarkNotificationRead()
  const markAll = useMarkAllNotificationsRead()

  function open(n: CrmNotification) {
    if (!n.is_read) {
      markRead.mutate(n.id, {
        onError: (err) => show({ title: err instanceof Error ? err.message : "Couldn't mark as read", tone: 'error' }),
      })
    }
    const to = notificationRoute(n.entity_type, n.entity_id)
    if (to) navigate(to)
  }

  function readAll() {
    markAll.mutate(undefined, {
      onSuccess: () => show({ title: 'All notifications marked as read', tone: 'success' }),
      onError: (err) => show({ title: err instanceof Error ? err.message : "Couldn't mark all as read", tone: 'error' }),
    })
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[var(--surface)]">
      <PageHeader
        title="Notifications"
        subtitle="Reminders for follow-ups, meetings, tasks, tickets and subscriptions"
        action={
          <Button size="sm" variant="outline" disabled={unread === 0 || markAll.isPending} onClick={readAll} className="gap-1.5">
            <CheckCheck size={14} /> Mark all read
          </Button>
        }
      />
      <div className="space-y-4 p-4">
        <div className="flex items-center gap-1 self-start rounded-lg border border-[var(--border)] p-1" role="tablist">
          {(['all', 'unread'] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={
                tab === t
                  ? 'flex items-center gap-1.5 rounded-md bg-[var(--accent)] px-3 py-1.5 text-[12.5px] font-medium text-[var(--ink)]'
                  : 'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] font-medium text-[var(--text-muted)] hover:bg-[var(--surface-hover)]'
              }
            >
              {t === 'all' ? 'All' : 'Unread'}
              {t === 'unread' && unread > 0 && (
                <span className="rounded-full bg-[var(--error)] px-1.5 text-[11px] font-semibold leading-4 text-white">{unread}</span>
              )}
            </button>
          ))}
        </div>

        {isLoading ? (
          <PageLoader />
        ) : isError ? (
          <p className="py-8 text-center text-[13px] text-[var(--error)]">Couldn't load notifications. Reopen the page to retry.</p>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center text-[var(--text-muted)]">
            <Bell size={22} />
            <p className="text-[13px]">{tab === 'unread' ? 'No unread notifications.' : 'No notifications yet.'}</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)]">
            {items.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => open(n)}
                className={cn(
                  'flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-[var(--surface-hover)]',
                  !n.is_read && 'bg-[var(--accent-bg)]/40',
                )}
              >
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent-bg)] text-[var(--accent-strong)]">
                  {notificationIcon(n.entity_type)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn('block truncate text-[13px] text-[var(--text-h)]', !n.is_read && 'font-semibold')}>{n.title}</span>
                  <span className="mt-0.5 line-clamp-2 block text-[12.5px] text-[var(--text-muted)]">{n.message}</span>
                  <span className="mt-1 block text-[11.5px] text-[var(--text-muted)]">{timeAgo(n.created_at)}</span>
                </span>
                {!n.is_read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[var(--accent)]" aria-label="Unread" />}
              </button>
            ))}
          </div>
        )}
        <InfiniteScrollFooter hasNextPage={Boolean(hasNextPage)} isFetchingNextPage={isFetchingNextPage} onLoadMore={() => void fetchNextPage()} />
      </div>
    </div>
  )
}
