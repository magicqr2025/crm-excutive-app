import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { InfiniteScrollFooter } from '@/components/ui/InfiniteScrollFooter'
import { SearchBox } from '@/components/ui/SearchBox'
import { PageLoader } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/useToast'
import { useLeadsPage } from '@/api/queries'
import { addExistingLeads } from '@/api/pipelineLeadsApi'
import { useAuthStore } from '@/store/useAuthStore'
import { cn } from '@/lib/utils'
import { SaveBar, TeamHeader } from '@/features/team/teamParts'
import { errorText } from '@/features/team/teamUtils'
import { usePipeline } from './pipelineQueries'

const MAX_AT_ONCE = 500

/** Puts contacts that already have a lead into this pipeline. */
export function AddExistingLeadsPage() {
  const { campaignId = '' } = useParams<{ campaignId: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const queryClient = useQueryClient()
  const userId = useAuthStore((s) => s.user?.id ?? '')
  const pipeline = usePipeline(campaignId)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirming, setConfirming] = useState(false)
  // Every lead in the business, a page at a time.
  const list = useLeadsPage({ staffId: userId, allStaff: true, unassigned: false, search })
  const back = () => navigate(`/campaigns/${campaignId}/leads`)

  const add = useMutation({
    mutationFn: () => addExistingLeads(campaignId, [...selected]),
    onSuccess: (result) => {
      toast.show({ title: `${result.allotted_count} lead${result.allotted_count === 1 ? '' : 's'} added to the pipeline`, tone: 'success' })
      void queryClient.invalidateQueries()
      back()
    },
    onError: (err) => toast.show({ title: errorText(err), tone: 'error' }),
  })

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else if (next.size < MAX_AT_ONCE) next.add(id)
      else toast.show({ title: `Add at most ${MAX_AT_ONCE} leads at a time` })
      return next
    })
  }

  const count = selected.size
  const plural = `${count} lead${count === 1 ? '' : 's'}`

  return (
    <div className="flex h-full flex-col">
      <TeamHeader title="Add existing leads" subtitle={pipeline.data?.name} backTo={`/campaigns/${campaignId}/leads`} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl space-y-3 px-4 py-4 md:px-6">
          <div className="[&>form]:max-w-none">
            <SearchBox value={search} onSubmit={setSearch} placeholder="Search by name or phone…" />
          </div>
          {list.isLoading ? (
            <PageLoader />
          ) : list.isError ? (
            <p className="py-8 text-center text-[13px] text-[var(--error)]">{errorText(list.error)}</p>
          ) : list.items.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-[var(--text-muted)]">{search ? 'No leads match.' : 'No leads yet.'}</p>
          ) : (
            <ul className="divide-y divide-[var(--border)] rounded-2xl bg-[var(--surface)] ring-1 ring-[var(--border)]">
              {list.items.map((lead) => {
                const here = lead.lead_campaigns.some((c) => c.id === campaignId)
                const others = lead.lead_campaigns.filter((c) => c.id !== campaignId).map((c) => c.name)
                return (
                  <li key={lead.id}>
                    <label className={cn('flex min-h-14 items-center gap-3 px-3.5 py-2.5', here ? 'opacity-55' : 'cursor-pointer')}>
                      <input type="checkbox" disabled={here} checked={selected.has(lead.id)} onChange={() => toggle(lead.id)} className="h-4 w-4 shrink-0 accent-[var(--accent)]" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-medium text-[var(--text-h)]">{lead.contact_name ?? 'Unknown'}</span>
                        <span className="block truncate text-[12px] text-[var(--text-muted)]">
                          {[lead.contact_phone, lead.assign_staff_name ?? 'Unassigned'].filter(Boolean).join(' · ')}
                        </span>
                        {others.length > 0 && <span className="block truncate text-[11.5px] text-[var(--accent-strong)]">In: {others.join(', ')}</span>}
                      </span>
                      {here && <span className="shrink-0 text-[11.5px] font-medium text-[var(--text-muted)]">Already here</span>}
                    </label>
                  </li>
                )
              })}
            </ul>
          )}
          <InfiniteScrollFooter hasNextPage={Boolean(list.hasNextPage)} isFetchingNextPage={list.isFetchingNextPage} onLoadMore={() => void list.fetchNextPage()} />
        </div>
      </div>

      <SaveBar note={count ? `${plural} selected` : 'Tick the leads to add'}>
        {count > 0 && (
          <Button variant="secondary" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        )}
        <Button onClick={() => setConfirming(true)} disabled={count === 0}>
          Add to pipeline
        </Button>
      </SaveBar>

      {confirming && (
        <Dialog open onClose={() => !add.isPending && setConfirming(false)} variant="sheet" className="sm:max-w-md">
          <Dialog.Header>
            <Dialog.Title>Add {plural}?</Dialog.Title>
            <Dialog.CloseButton onClose={() => !add.isPending && setConfirming(false)} />
          </Dialog.Header>
          <Dialog.Body className="space-y-2 text-[13.5px] text-[var(--text)]">
            <p>
              <span className="font-semibold">{pipeline.data?.name ?? 'This pipeline'}</span> becomes their main pipeline, so they may no longer appear in their old pipeline’s lead list.
            </p>
            <p>Leads without an owner may be assigned to staff by this pipeline’s rule.</p>
          </Dialog.Body>
          <Dialog.Footer>
            <Button variant="secondary" onClick={() => setConfirming(false)} disabled={add.isPending}>
              Cancel
            </Button>
            <Button onClick={() => add.mutate()} disabled={add.isPending}>
              {add.isPending ? 'Adding…' : 'Add leads'}
            </Button>
          </Dialog.Footer>
        </Dialog>
      )}
    </div>
  )
}
