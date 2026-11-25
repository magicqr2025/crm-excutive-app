import { useMemo, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MultiSelectField } from '@/components/ui/MultiSelectField'
import { useContactGroups, useLabels, useLead, useLeadStageTypes, useLeadStatuses } from '@/api/queries'
import { useCan } from '@/store/useAuthStore'
import { addLeadsToContactGroup, fetchActiveProducts, fetchMyLeadCampaigns, removeLeadsFromContactGroup, setLeadCampaignsForLead, setLeadLabels, setProductsForLead, updateLead } from '@/api/crmApi'

// "Update lead" while completing a follow-up (ported from orm-whatsapp's LeadUpdatePanel): stage, then that
// stage's status, labels and groups, all starting on the lead's current values. Only what changed is saved,
// after the follow-up itself is completed.

interface LeadEdit {
  stageId: string
  statusId: string
  labelIds: string[]
  groupIds: string[]
  campaignIds: string[]
  productIds: string[]
}

/** What changed on the lead. Only the parts that changed are present. */
export interface LeadChanges {
  leadId: string
  statusId?: string
  labelIds?: string[]
  addGroupIds?: string[]
  removeGroupIds?: string[]
  /** The lead's whole new list of pipelines. */
  campaignIds?: string[]
  /** The lead's whole new list of products. */
  productIds?: string[]
}

/** One part of a lead, for an editor that shows only that part (a tile's pencil on the lead page). */
export type LeadField = 'status' | 'labels' | 'groups' | 'pipelines' | 'products'

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x))

/**
 * Loads the lead and keeps the edit; `panel` renders the box, `changes()` is what to save.
 * `pipelinesAndProducts` also offers the lead's pipelines and products, each only to a role that may change them.
 * `only` shows (and saves) just that one part, without the "Update lead" box around it.
 */
export function useLeadUpdate(
  leadId: string | null | undefined,
  findingLead = false,
  opts: { pipelinesAndProducts?: boolean; only?: LeadField } = {},
) {
  const { data: lead, isLoading: leadLoading } = useLead(leadId ?? '')
  const { data: stages = [] } = useLeadStageTypes()
  const { data: allStatuses, isSuccess: statusesLoaded } = useLeadStatuses()
  const { data: labels = [] } = useLabels()
  // Changing groups needs "add" on contact groups; without it the field is hidden rather than refused on save.
  const canGroups = useCan('contact_groups', 'add')
  const { data: groups = [], isSuccess: groupsLoaded } = useContactGroups()
  const canEditPipelines = useCan('lead_campaigns', 'edit')
  const canEditProducts = useCan('products', 'edit')
  const only = opts.only
  const shows = (field: LeadField) => !only || only === field
  const showStatus = shows('status')
  const showLabels = shows('labels')
  const showGroups = shows('groups') && canGroups
  const showPipelines = (opts.pipelinesAndProducts === true || only === 'pipelines') && shows('pipelines') && canEditPipelines
  const showProducts = (opts.pipelinesAndProducts === true || only === 'products') && shows('products') && canEditProducts
  // Same cache keys as useMyLeadCampaigns / useActiveProducts; only loaded when the fields are shown.
  const { data: myCampaigns = [] } = useQuery({ queryKey: ['my-lead-campaigns'], queryFn: fetchMyLeadCampaigns, enabled: showPipelines })
  const { data: products = [] } = useQuery({ queryKey: ['products', 'active'], queryFn: fetchActiveProducts, enabled: showProducts })
  const [draft, setDraft] = useState<LeadEdit | null>(null)

  const statuses = useMemo(
    () => (allStatuses ?? []).filter((s) => s.status === undefined || s.status === '1').sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0)),
    [allStatuses],
  )

  const initial = useMemo<LeadEdit | null>(() => {
    if (!lead || !statusesLoaded) return null
    // A current backend sends the status id; an older one only its name and colour.
    const current =
      statuses.find((s) => s.id === lead.lead_status_id) ??
      statuses.find((s) => s.lead_status === lead.lead_status && s.color === lead.lead_status_color) ??
      statuses.find((s) => s.lead_status === lead.lead_status)
    return {
      stageId: current?.stage_id ?? lead.lead_stage_id ?? '',
      statusId: current?.id ?? '',
      labelIds: (lead.labels ?? []).map((l) => l.id),
      groupIds: (lead.groups ?? []).map((g) => g.id),
      campaignIds: lead.lead_campaigns.map((c) => c.id),
      productIds: (lead.products ?? []).map((p) => p.id),
    }
  }, [lead, statuses, statusesLoaded])

  const edit = draft ?? initial
  const stageStatuses = edit ? statuses.filter((s) => s.stage_id === edit.stageId) : []
  const invalid = showStatus && !!edit && !!edit.stageId && !edit.statusId && edit.stageId !== initial?.stageId

  function changes(): LeadChanges | undefined {
    if (!lead || !edit || !initial) return undefined
    const c: LeadChanges = { leadId: lead.id }
    if (showStatus && edit.statusId && edit.statusId !== initial.statusId) c.statusId = edit.statusId
    if (showLabels && !sameSet(edit.labelIds, initial.labelIds)) c.labelIds = edit.labelIds
    if (showGroups) {
      const added = edit.groupIds.filter((id) => !initial.groupIds.includes(id))
      const removed = initial.groupIds.filter((id) => !edit.groupIds.includes(id))
      if (added.length) c.addGroupIds = added
      if (removed.length) c.removeGroupIds = removed
    }
    if (showPipelines && !sameSet(edit.campaignIds, initial.campaignIds)) c.campaignIds = edit.campaignIds
    if (showProducts && !sameSet(edit.productIds, initial.productIds)) c.productIds = edit.productIds
    return Object.keys(c).length > 1 ? c : undefined
  }

  let panel: ReactNode
  if (!leadId && findingLead) panel = <Note>Loading lead…</Note>
  else if (!leadId) panel = <Note>This contact has no lead you can update.</Note>
  else if (leadLoading || (lead && !edit)) panel = <Note>Loading lead…</Note>
  else if (!lead || !edit || !initial) panel = <Note>This contact has no lead you can update.</Note>
  else {
    const changed = {
      stage: edit.stageId !== initial.stageId,
      status: edit.statusId !== initial.statusId,
      labels: !sameSet(edit.labelIds, initial.labelIds),
      groups: !sameSet(edit.groupIds, initial.groupIds),
      pipelines: showPipelines && !sameSet(edit.campaignIds, initial.campaignIds),
      products: showProducts && !sameSet(edit.productIds, initial.productIds),
    }
    // The pickers list what this person can see, plus whatever the lead already has (so nothing is dropped unseen).
    const pipelineOptions = withCurrent(myCampaigns.map((c) => ({ value: c.id, label: c.name })), lead.lead_campaigns)
    const productOptions = withCurrent(products.map((p) => ({ value: p.id, label: p.name })), lead.products ?? [])
    const changeCount = Object.values(changed).filter(Boolean).length
    const statusColor = stageStatuses.find((s) => s.id === edit.statusId)?.color ?? undefined
    const pickStage = (stageId: string) => setDraft({ ...edit, stageId, statusId: statuses.find((s) => s.stage_id === stageId)?.id ?? '' })

    const fields = (
      <>
        {showStatus && only === 'status' && (
          // On its own (the status chip's editor) every choice is a chip to tap: easier than two dropdowns on a phone.
          <div className="space-y-4">
            <Row label="Stage" changed={changed.stage}>
              <div role="radiogroup" aria-label="Stage" className="flex flex-wrap gap-2">
                {stages.map((st) => (
                  <ChoiceChip key={st.id} selected={edit.stageId === st.id} onClick={() => pickStage(st.id)}>
                    {st.lead_stage}
                  </ChoiceChip>
                ))}
              </div>
            </Row>
            <Row label="Status" changed={changed.status}>
              {stageStatuses.length === 0 ? (
                <p className="text-[13px] text-[var(--text-muted)]">{edit.stageId ? 'This stage has no statuses.' : 'Pick a stage first.'}</p>
              ) : (
                <div role="radiogroup" aria-label="Status" className="flex flex-wrap gap-2">
                  {stageStatuses.map((st) => (
                    <ChoiceChip key={st.id} selected={edit.statusId === st.id} dot={st.color ?? undefined} onClick={() => setDraft({ ...edit, statusId: st.id })}>
                      {st.lead_status}
                    </ChoiceChip>
                  ))}
                </div>
              )}
            </Row>
          </div>
        )}
        {showStatus && only !== 'status' && (
          <div className="grid gap-3 sm:grid-cols-2">
          <Row label="Stage" changed={changed.stage}>
            <SelectBox>
              <select aria-label="Stage" value={edit.stageId} onChange={(e) => pickStage(e.target.value)} className={cn(SELECT, 'pl-3')}>
                {!edit.stageId && <option value="">Select stage</option>}
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.lead_stage}
                  </option>
                ))}
              </select>
            </SelectBox>
          </Row>
          <Row label="Status" changed={changed.status}>
            <SelectBox dot={statusColor}>
              <select
                aria-label="Status"
                value={edit.statusId}
                onChange={(e) => setDraft({ ...edit, statusId: e.target.value })}
                disabled={!edit.stageId || stageStatuses.length === 0}
                className={cn(SELECT, statusColor ? 'pl-8' : 'pl-3')}
              >
                {!edit.statusId && (
                  <option value="">{!edit.stageId ? 'Pick a stage first' : stageStatuses.length === 0 ? 'No statuses' : 'Select status'}</option>
                )}
                {stageStatuses.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.lead_status}
                  </option>
                ))}
              </select>
            </SelectBox>
          </Row>
        </div>
        )}
        {invalid && <p className="-mt-1.5 text-[13px] text-[var(--error)]">This stage has no statuses. Pick another stage.</p>}

        {showLabels && (
        <Row label="Labels" changed={changed.labels}>
          <MultiSelectField
            options={labels.map((l) => ({ value: l.id, label: l.name }))}
            value={edit.labelIds}
            onChange={(labelIds) => setDraft({ ...edit, labelIds })}
            allLabel="Select labels"
            searchPlaceholder="Search labels"
          />
        </Row>
        )}

        {showGroups && groupsLoaded && (
          <Row label="Groups" changed={changed.groups}>
            <MultiSelectField
              options={groups.map((g) => ({ value: g.id, label: g.name }))}
              value={edit.groupIds}
              onChange={(groupIds) => setDraft({ ...edit, groupIds })}
              allLabel="Select groups"
              searchPlaceholder="Search groups"
            />
          </Row>
        )}

        {showPipelines && (
          <Row label="Pipelines" changed={changed.pipelines}>
            <MultiSelectField
              options={pipelineOptions}
              value={edit.campaignIds}
              onChange={(campaignIds) => setDraft({ ...edit, campaignIds })}
              allLabel="Select pipelines"
              searchPlaceholder="Search pipelines"
            />
          </Row>
        )}

        {showProducts && (
          <Row label="Products" changed={changed.products}>
            <MultiSelectField
              options={productOptions}
              value={edit.productIds}
              onChange={(productIds) => setDraft({ ...edit, productIds })}
              allLabel="Select products"
              searchPlaceholder="Search products"
            />
          </Row>
        )}
      </>
    )

    panel = only ? (
      <div className="space-y-3.5">{fields}</div>
    ) : (
      <section className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        <header className="flex items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--bg)] px-3.5 py-2">
          <p className="text-[14px] font-semibold text-[var(--text-h)]">Update lead</p>
          {changeCount > 0 ? (
            <span className="flex items-center gap-2 text-[13px]">
              <span className="rounded-full bg-[var(--accent-bg)] px-2 py-0.5 font-semibold text-[var(--accent-strong)]">
                {changeCount} {changeCount === 1 ? 'change' : 'changes'}
              </span>
              <button
                type="button"
                onClick={() => setDraft(null)}
                className="flex items-center gap-1 rounded-md border border-[var(--accent-border)] bg-[var(--surface)] px-2 py-0.5 font-semibold text-[var(--accent-strong)] outline-none transition-colors hover:bg-[var(--accent-bg)] focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)]"
              >
                <RotateCcw size={11} strokeWidth={2.5} /> Reset
              </button>
            </span>
          ) : (
            <span className="text-[13px] text-[var(--text-muted)]">Current values</span>
          )}
        </header>

        <div className="space-y-3.5 px-3.5 py-3.5">
          {fields}
        </div>
      </section>
    )
  }

  return { panel, changes, invalid }
}

/**
 * Saves the lead part of a completed follow-up. Each part on its own, so one refusal doesn't stop the others;
 * resolves to the names of the parts that failed.
 */
export function useSaveLeadChanges() {
  const queryClient = useQueryClient()
  return async function save(c: LeadChanges): Promise<string[]> {
    const jobs: { name: string; run: () => Promise<unknown> }[] = []
    if (c.statusId) jobs.push({ name: 'status', run: () => updateLead(c.leadId, { lead_status_id: c.statusId }) })
    if (c.labelIds) jobs.push({ name: 'labels', run: () => setLeadLabels(c.leadId, c.labelIds!) })
    for (const id of c.addGroupIds ?? []) jobs.push({ name: 'groups', run: () => addLeadsToContactGroup(id, [c.leadId]) })
    for (const id of c.removeGroupIds ?? []) jobs.push({ name: 'groups', run: () => removeLeadsFromContactGroup(id, [c.leadId]) })
    if (c.campaignIds) jobs.push({ name: 'pipelines', run: () => setLeadCampaignsForLead(c.leadId, c.campaignIds!) })
    if (c.productIds) jobs.push({ name: 'products', run: () => setProductsForLead(c.leadId, c.productIds!) })

    const results = await Promise.allSettled(jobs.map((j) => j.run()))
    const failed = [...new Set(jobs.filter((_, i) => results[i].status === 'rejected').map((j) => j.name))]
    queryClient.invalidateQueries({ queryKey: ['my-leads'] })
    queryClient.invalidateQueries({ queryKey: ['campaign-leads'] })
    queryClient.invalidateQueries({ queryKey: ['lead-activity', c.leadId] })
    return failed
  }
}

function withCurrent(options: { value: string; label: string }[], current: { id: string; name: string }[]) {
  const missing = current.filter((c) => !options.some((o) => o.value === c.id)).map((c) => ({ value: c.id, label: c.name }))
  return [...options, ...missing]
}

const SELECT =
  'h-11 w-full appearance-none rounded-lg border border-[var(--border)] bg-[var(--bg)] pr-9 text-[15px] text-[var(--text-h)] outline-none transition-[border-color,box-shadow] focus:border-[var(--accent-border)] focus:ring-3 focus:ring-[var(--accent-bg)] disabled:cursor-not-allowed disabled:opacity-60'

function Note({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-[var(--border)] px-3.5 py-3 text-[13.5px] text-[var(--text-muted)]">{children}</p>
}

function ChoiceChip({ selected, dot, onClick, children }: { selected: boolean; dot?: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        'inline-flex min-h-10 items-center gap-2 rounded-full border px-3.5 text-[14px] font-medium transition-colors',
        selected
          ? 'border-[var(--accent)] bg-[var(--accent-bg)] text-[var(--accent-strong)]'
          : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-h)] hover:bg-[var(--surface-hover)]',
      )}
    >
      {dot && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: dot }} />}
      {children}
    </button>
  )
}

function Row({ label, changed, children }: { label: string; changed: boolean; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-[14px] font-medium text-[var(--text-h)]">{label}</span>
        {changed && (
          <span className="flex items-center gap-1 text-[12.5px] font-medium text-[var(--accent-strong)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-strong)]" /> Changed
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

/** A native select with our own chevron and, optionally, the chosen option's colour dot on the left. */
function SelectBox({ dot, children }: { dot?: string; children: ReactNode }) {
  return (
    <div className="relative">
      {dot && <span className="pointer-events-none absolute left-3 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full" style={{ backgroundColor: dot }} />}
      {children}
      <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
    </div>
  )
}
