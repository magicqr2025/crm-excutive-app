import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '@/components/layout/PageHeader'
import { SearchBox } from '@/components/ui/SearchBox'
import { InfiniteScrollFooter } from '@/components/ui/InfiniteScrollFooter'
import { PageLoader } from '@/components/ui/Spinner'
import { useSubscriptionsPage } from '@/api/queries'
import type { CrmSubscription, SubscriptionStatusFilter } from '@/api/crmApi'
import { SubscriptionCard } from './SubscriptionCard'
import { RenewDialog } from './RenewDialog'
import { LostDialog } from './LostDialog'
import { PaymentDialog } from './PaymentDialog'

const FILTERS: { value: SubscriptionStatusFilter | 'all'; label: string }[] = [
  { value: 'expiring', label: 'Expiring' },
  { value: 'active', label: 'Active' },
  { value: 'expired', label: 'Expired' },
  { value: 'lost', label: 'Lost' },
  { value: 'all', label: 'All' },
]

// The signed-in executive's subscriptions (the server only returns the ones
// they sell or created), soonest-ending first, so the ones that need a renewal
// call lead the list. Server-paged with infinite scroll like the other lists.
export function SubscriptionsPage() {
  const [filter, setFilter] = useState<SubscriptionStatusFilter | 'all'>('expiring')
  const [search, setSearch] = useState('')
  const [renewing, setRenewing] = useState<CrmSubscription | null>(null)
  const [losing, setLosing] = useState<CrmSubscription | null>(null)
  const [paying, setPaying] = useState<CrmSubscription | null>(null)
  const queryClient = useQueryClient()
  const { items, total, isLoading, isError, error, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useSubscriptionsPage({ search, status: filter === 'all' ? undefined : filter })

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[var(--surface)]">
      <PageHeader title="Subscriptions" subtitle={`${total} subscription${total === 1 ? '' : 's'}`} />
      <div className="space-y-2 px-4 pt-3">
        <SearchBox value={search} onSubmit={setSearch} placeholder="Search by customer or product…" />
        <div className="flex w-full items-center gap-1 overflow-x-auto rounded-lg border border-[var(--border)] p-1 sm:w-auto sm:self-start">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={
                filter === f.value
                  ? 'flex-1 whitespace-nowrap rounded-md bg-[var(--accent)] px-2.5 py-1.5 text-[12.5px] font-medium text-[var(--ink)]'
                  : 'flex-1 whitespace-nowrap rounded-md px-2.5 py-1.5 text-[12.5px] font-medium text-[var(--text-muted)] hover:bg-[var(--surface-hover)]'
              }
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <div className="p-4">
        {isLoading ? (
          <PageLoader />
        ) : isError ? (
          <div className="py-8 text-center text-[13px] text-[var(--error)]">
            <p>{error instanceof Error ? error.message : 'Could not load subscriptions.'}</p>
            <button onClick={() => void queryClient.invalidateQueries({ queryKey: ['subscriptions'] })} className="mt-2 underline">
              Try again
            </button>
          </div>
        ) : items.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-[var(--text-muted)]">No subscriptions here.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((sub) => (
              <SubscriptionCard key={sub.id} subscription={sub} onRenew={setRenewing} onLost={setLosing} onPayment={setPaying} />
            ))}
          </div>
        )}
        <InfiniteScrollFooter
          hasNextPage={Boolean(hasNextPage)}
          isFetchingNextPage={isFetchingNextPage}
          onLoadMore={() => void fetchNextPage()}
        />
      </div>
      <RenewDialog subscription={renewing} onClose={() => setRenewing(null)} />
      <LostDialog subscription={losing} onClose={() => setLosing(null)} />
      <PaymentDialog subscription={paying} onClose={() => setPaying(null)} />
    </div>
  )
}
