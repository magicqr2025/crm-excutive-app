import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRightLeft, KanbanSquare } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { PageLoader } from '@/components/ui/Spinner'
import { SearchBox } from '@/components/ui/SearchBox'
import { useToast } from '@/components/ui/useToast'
import { useAllLeads, useLeadStageTypes, useLeadStatuses, useStaffList, useUpdateLead } from '@/api/queries'
import type { CrmLead, CrmLeadStatus } from '@/api/crmApi'
import { useIsAdminOrManager } from '@/store/useAuthStore'
import { cn } from '@/lib/utils'

const NO_STATUS = 'none'
const NO_STATUS_COLOR = '#8c94a3'
const SELECT_CLASS = 'h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text-h)]'

interface Column {
  id: string
  name: string | null
  label: string
  color: string
}

function LeadCard({ lead, onOpen, onMove }: { lead: CrmLead; onOpen: () => void; onMove: () => void }) {
  const pipelines = lead.lead_campaigns.map((c) => c.name)
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2.5 shadow-[var(--shadow-sm)]">
      <button type="button" onClick={onOpen} className="block w-full text-left">
        <span className="flex items-center gap-2">
          <Avatar name={lead.contact_name ?? 'Unknown'} size={28} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium text-[var(--text-h)]">{lead.contact_name ?? 'Unknown contact'}</span>
            <span className="block truncate text-[11.5px] text-[var(--text-muted)]">{lead.contact_phone ?? '—'}</span>
          </span>
        </span>
        {pipelines.length > 0 && <span className="mt-1.5 block truncate text-[11.5px] text-[var(--text-muted)]">{pipelines.join(' · ')}</span>}
        {lead.assign_staff_name && <span className="block truncate text-[11.5px] text-[var(--text-muted)]">Assigned to {lead.assign_staff_name}</span>}
      </button>
      <Button size="sm" variant="ghost" onClick={onMove} className="mt-1.5 h-7 w-full justify-center gap-1.5 text-[12px] text-[var(--accent-strong)]">
        <ArrowRightLeft size={12} /> Move to…
      </Button>
    </div>
  )
}

/** Your leads as columns, one per lead status. Swipe sideways between columns; tap "Move to…" to change a lead's status. */
export function LeadBoardPage() {
  const navigate = useNavigate()
  const { show } = useToast()
  const seesAll = useIsAdminOrManager()
  const { data: allLeads = [], isLoading } = useAllLeads()
  const { data: statuses = [] } = useLeadStatuses()
  const { data: stageTypes = [] } = useLeadStageTypes()
  const { data: staff = [] } = useStaffList()
  const updateLead = useUpdateLead()

  const [search, setSearch] = useState('')
  const [stageId, setStageId] = useState<string | null>(null)
  const [pipelineId, setPipelineId] = useState('')
  const [staffId, setStaffId] = useState('')
  const [moving, setMoving] = useState<CrmLead | null>(null)

  const pipelines = useMemo(() => {
    const seen = new Map<string, string>()
    for (const l of allLeads) for (const c of l.lead_campaigns) seen.set(c.id, c.name)
    return [...seen].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [allLeads])

  const leads = useMemo(() => {
    const term = search.trim().toLowerCase()
    return allLeads.filter((l) => {
      if (pipelineId && !l.lead_campaigns.some((c) => c.id === pipelineId)) return false
      if (seesAll && staffId && (staffId === NO_STATUS ? l.assign_to_staff_id : l.assign_to_staff_id !== staffId)) return false
      if (term && ![l.contact_name, l.contact_phone, l.contact_email].some((v) => v?.toLowerCase().includes(term))) return false
      return true
    })
  }, [allLeads, search, pipelineId, staffId, seesAll])

  const sortedStatuses = useMemo(
    () =>
      statuses
        .filter((s) => !stageId || s.stage_id === stageId)
        .slice()
        .sort((a, b) => Number(a.stage_id) - Number(b.stage_id) || (a.sequence ?? 0) - (b.sequence ?? 0)),
    [statuses, stageId],
  )

  const columns = useMemo<Column[]>(
    () => [
      ...(stageId ? [] : [{ id: NO_STATUS, name: null, label: 'No status', color: NO_STATUS_COLOR }]),
      ...sortedStatuses.map((s) => ({ id: s.id, name: s.lead_status, label: s.lead_status, color: s.color ?? NO_STATUS_COLOR })),
    ],
    [sortedStatuses, stageId],
  )

  const byColumn = useMemo(() => {
    const map = new Map<string, CrmLead[]>(columns.map((c) => [c.id, []]))
    for (const lead of leads) {
      const column = columns.find((c) => c.name !== null && c.name === lead.lead_status)
      if (column) map.get(column.id)?.push(lead)
      // No matching column and no stage filter: bucket under "No status". Otherwise it belongs to another stage.
      else if (!stageId) map.get(NO_STATUS)?.push(lead)
    }
    return map
  }, [columns, leads, stageId])

  function moveTo(lead: CrmLead, status: CrmLeadStatus) {
    setMoving(null)
    if (lead.lead_status === status.lead_status) return
    updateLead.mutate(
      { id: lead.id, patch: { lead_status_id: status.id } },
      {
        onSuccess: () => show({ title: `Moved to ${status.lead_status}`, tone: 'success' }),
        onError: (err) => show({ title: err instanceof Error ? err.message : 'Could not move the lead', tone: 'error' }),
      },
    )
  }

  const hasFilters = search !== '' || pipelineId !== '' || staffId !== ''

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[var(--surface)]">
      <PageHeader
        title="Lead Board"
        subtitle={`${leads.length}${hasFilters ? ` of ${allLeads.length}` : ''} lead${leads.length === 1 ? '' : 's'}`}
      />
      <div className="shrink-0 space-y-2 px-4 pt-3">
        <SearchBox value={search} onSubmit={setSearch} placeholder="Search name, phone or email…" />
        <div className="scrollbar-thin flex gap-1.5 overflow-x-auto" role="tablist" aria-label="Stage">
          {[{ id: null as string | null, label: 'All stages' }, ...stageTypes.map((s) => ({ id: s.id as string | null, label: s.lead_stage }))].map((s) => (
            <button
              key={s.id ?? 'all'}
              type="button"
              role="tab"
              aria-selected={stageId === s.id}
              onClick={() => setStageId(s.id)}
              className={cn(
                'h-8 shrink-0 rounded-full border px-3 text-[12.5px] font-medium transition-colors',
                stageId === s.id ? 'border-[var(--accent)] bg-[var(--accent-bg)] text-[var(--accent-strong)]' : 'border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)]',
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className={cn('grid gap-2', seesAll ? 'grid-cols-2' : 'grid-cols-1')}>
          <select aria-label="Pipeline" value={pipelineId} onChange={(e) => setPipelineId(e.target.value)} className={SELECT_CLASS}>
            <option value="">All pipelines</option>
            {pipelines.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {seesAll && (
            <select aria-label="Assigned staff" value={staffId} onChange={(e) => setStaffId(e.target.value)} className={SELECT_CLASS}>
              <option value="">All staff</option>
              <option value={NO_STATUS}>Unassigned</option>
              {staff.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {`${m.first_name ?? ''} ${m.last_name ?? ''}`.trim() || m.user_id}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-x-auto px-4 py-3">
        {isLoading ? (
          <PageLoader />
        ) : statuses.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center text-[var(--text-muted)]">
            <KanbanSquare size={24} />
            <p className="text-[13.5px] font-medium text-[var(--text-h)]">No lead statuses yet</p>
            <p className="max-w-xs text-[12.5px]">An admin adds lead statuses in the admin app. They become the board's columns.</p>
          </div>
        ) : (
          <div className="flex h-full snap-x snap-mandatory gap-3">
            {columns.map((column) => {
              const items = byColumn.get(column.id) ?? []
              return (
                <section key={column.id} className="flex h-full w-[78vw] max-w-[300px] shrink-0 snap-start flex-col rounded-xl border border-[var(--border)] bg-[var(--surface-hover)]">
                  <header className="flex shrink-0 items-center gap-2 border-b border-[var(--border)] px-3 py-2.5">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: column.color }} />
                    <h2 className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[var(--text-h)]">{column.label}</h2>
                    <span className="rounded-full bg-[var(--surface)] px-2 py-0.5 text-[11.5px] font-semibold tabular-nums text-[var(--text-muted)]">{items.length}</span>
                  </header>
                  <div className="scrollbar-thin min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
                    {items.length === 0 ? (
                      <p className="py-6 text-center text-[12px] text-[var(--text-muted)]">No leads</p>
                    ) : (
                      items.map((lead) => <LeadCard key={lead.id} lead={lead} onOpen={() => navigate(`/contacts/${lead.id}`)} onMove={() => setMoving(lead)} />)
                    )}
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </div>

      <Dialog open={moving !== null} onClose={() => setMoving(null)}>
        <Dialog.Header>
          <Dialog.Title className="truncate">Move {moving?.contact_name ?? 'lead'}</Dialog.Title>
          <Dialog.CloseButton onClose={() => setMoving(null)} />
        </Dialog.Header>
        <Dialog.Body className="space-y-1.5">
          <p className="mb-2 text-[12.5px] text-[var(--text-muted)]">Currently: {moving?.lead_status ?? 'No status'}</p>
          {statuses
            .slice()
            .sort((a, b) => Number(a.stage_id) - Number(b.stage_id) || (a.sequence ?? 0) - (b.sequence ?? 0))
            .map((s) => {
              const current = moving?.lead_status === s.lead_status
              const stage = stageTypes.find((t) => t.id === s.stage_id)?.lead_stage
              return (
                <button
                  key={s.id}
                  type="button"
                  disabled={current || updateLead.isPending}
                  onClick={() => moving && moveTo(moving, s)}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-[13.5px]',
                    current ? 'border-[var(--accent-border)] bg-[var(--accent-bg)] text-[var(--accent-strong)]' : 'border-[var(--border)] text-[var(--text-h)] hover:bg-[var(--surface-hover)]',
                  )}
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color ?? NO_STATUS_COLOR }} />
                  <span className="min-w-0 flex-1 truncate">{s.lead_status}</span>
                  {stage && <span className="shrink-0 text-[11.5px] text-[var(--text-muted)]">{stage}</span>}
                  {current && <span className="shrink-0 text-[11.5px] font-medium">Current</span>}
                </button>
              )
            })}
        </Dialog.Body>
      </Dialog>
    </div>
  )
}
