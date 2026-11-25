import { useState, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { useActiveProducts, useContactGroups, useLabels, useLeadFlags, useLeadStageTypes, useLeadStatuses, useStaffList } from '@/api/queries'
import { SELECT_CLASS } from '@/features/meetings/meetingUi'
import { cn } from '@/lib/utils'
import {
  DATE_OPTIONS,
  FOLLOWUP_OPTIONS,
  MEETING_OPTIONS,
  NONE,
  NO_LEAD_FILTERS,
  UNASSIGNED,
  activeFilterCount,
  type CampaignLeadFilters,
  type DatePreset,
} from './campaignLeadFilters'

interface Option {
  id: string
  name: string
}

interface CampaignLeadFilterDialogProps {
  open: boolean
  onClose: () => void
  value: CampaignLeadFilters
  onApply: (next: CampaignLeadFilters) => void
  /** Admins also pick a staff member; everyone else only sees their own leads. */
  showStaff: boolean
}

/** The pipeline leads Filters popup: edits a draft, the list changes only on "Show leads". */
export function CampaignLeadFilterDialog({ open, onClose, value, onApply, showStaff }: CampaignLeadFilterDialogProps) {
  return (
    <Dialog open={open} onClose={onClose}>
      {/* Remounted on every open, so the draft starts from what the list shows. */}
      {open && <FilterForm value={value} onApply={onApply} onClose={onClose} showStaff={showStaff} />}
    </Dialog>
  )
}

function FilterForm({ value, onApply, onClose, showStaff }: Omit<CampaignLeadFilterDialogProps, 'open'>) {
  const [draft, setDraft] = useState<CampaignLeadFilters>(value)
  const patch = (next: Partial<CampaignLeadFilters>) => setDraft((d) => ({ ...d, ...next }))
  const on = activeFilterCount(draft)
  // A custom range needs at least one end.
  const incomplete = draft.datePreset === 'custom' && !draft.from && !draft.to

  const { data: stageTypes = [] } = useLeadStageTypes()
  const { data: statuses = [] } = useLeadStatuses()
  const { data: labels = [] } = useLabels()
  const { data: groups = [] } = useContactGroups()
  const { data: products = [] } = useActiveProducts()
  const { data: flags = [] } = useLeadFlags()
  const { data: staff = [] } = useStaffList()

  const stageName = new Map(stageTypes.map((s) => [s.id, s.lead_stage] as const))
  // A stage picked: only that stage's statuses. All stages: every status as
  // "Stage - Status", since status names repeat across stages.
  const statusOptions: Option[] = [...statuses]
    .filter((s) => !draft.stageId || s.stage_id === draft.stageId)
    .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))
    .map((s) => ({ id: s.id, name: draft.stageId ? s.lead_status : `${stageName.get(s.stage_id) ?? 'Stage'} - ${s.lead_status}` }))
  // Changing the stage drops a status from another stage (it would match nothing).
  const pickStage = (stageId: string) => {
    const keepStatus = !stageId || statuses.find((s) => s.id === draft.statusId)?.stage_id === stageId
    patch({ stageId, statusId: keepStatus ? draft.statusId : '' })
  }

  return (
    <>
      <Dialog.Header>
        <div className="flex items-center gap-2.5">
          <Dialog.Title>Filters</Dialog.Title>
          {on > 0 && <span className="rounded-full bg-[var(--accent-bg)] px-2 py-0.5 text-[11.5px] font-semibold text-[var(--accent-strong)]">{on} on</span>}
        </div>
        <Dialog.CloseButton onClose={onClose} />
      </Dialog.Header>
      <Dialog.Body className="space-y-6">
        <Section title="When" hint="Lead created">
          <Chips
            label="Date"
            value={draft.datePreset}
            choices={DATE_OPTIONS}
            onPick={(v) => patch(v === 'custom' ? { datePreset: 'custom' } : { datePreset: v as DatePreset, from: '', to: '' })}
          />
          {draft.datePreset === 'custom' && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--accent-border)] bg-[var(--accent-bg)] p-2.5">
              <input
                type="date"
                aria-label="From date"
                value={draft.from}
                max={draft.to || undefined}
                onChange={(e) => patch({ from: e.target.value })}
                className={cn(SELECT_CLASS, 'w-auto flex-1')}
              />
              <span aria-hidden className="text-[var(--text-muted)]">
                →
              </span>
              <input
                type="date"
                aria-label="To date"
                value={draft.to}
                min={draft.from || undefined}
                onChange={(e) => patch({ to: e.target.value })}
                className={cn(SELECT_CLASS, 'w-auto flex-1')}
              />
            </div>
          )}
        </Section>

        <Section title="Who & stage">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {showStaff && (
              <SelectField label="User" value={draft.staffId} onClear={() => patch({ staffId: '' })}>
                <select aria-label="User" value={draft.staffId} onChange={(e) => patch({ staffId: e.target.value })} className={selectClass(draft.staffId)}>
                  <option value="">All users</option>
                  <option value={UNASSIGNED}>Unassigned</option>
                  {staff.map((s) => (
                    <option key={s.user_id} value={s.user_id}>
                      {[s.first_name, s.last_name].filter(Boolean).join(' ') || 'Staff'}
                    </option>
                  ))}
                </select>
              </SelectField>
            )}
            <SelectField label="Stage" value={draft.stageId} onClear={() => pickStage('')}>
              <select aria-label="Stage" value={draft.stageId} onChange={(e) => pickStage(e.target.value)} className={selectClass(draft.stageId)}>
                <option value="">All stages</option>
                {stageTypes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.lead_stage}
                  </option>
                ))}
              </select>
            </SelectField>
          </div>
        </Section>

        <Section title="Lead details">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* A stage picked: "Any" means any of that stage's statuses, and "No status" isn't offered (a lead with no status has no stage). */}
            <IdSelect
              label="Status"
              anyText={draft.stageId ? `Any ${stageName.get(draft.stageId) ?? 'stage'} status` : 'All statuses'}
              noneText={draft.stageId ? null : 'No status'}
              value={draft.statusId}
              options={statusOptions}
              onChange={(v) => patch({ statusId: v })}
            />
            <IdSelect label="Label" anyText="All labels" noneText="No label" value={draft.labelId} options={labels} onChange={(v) => patch({ labelId: v })} />
            <IdSelect label="Group" anyText="All groups" noneText="No group" value={draft.groupId} options={groups} onChange={(v) => patch({ groupId: v })} />
            <IdSelect label="Product" anyText="All products" noneText="No product" value={draft.productId} options={products} onChange={(v) => patch({ productId: v })} />
            <IdSelect
              label="Call flag"
              anyText="All call flags"
              noneText="No call flag"
              value={draft.flagId}
              options={flags.filter((f) => f.active)}
              onChange={(v) => patch({ flagId: v })}
            />
          </div>
        </Section>

        <Section title="Activity">
          <div className="space-y-3">
            <Chips label="Follow-up" showLabel value={draft.followup} choices={FOLLOWUP_OPTIONS} onPick={(v) => patch({ followup: v as CampaignLeadFilters['followup'] })} />
            <Chips label="Meeting" showLabel value={draft.meeting} choices={MEETING_OPTIONS} onPick={(v) => patch({ meeting: v as CampaignLeadFilters['meeting'] })} />
          </div>
        </Section>
      </Dialog.Body>
      <Dialog.Footer>
        <Button variant="ghost" className="mr-auto" disabled={on === 0} onClick={() => setDraft(NO_LEAD_FILTERS)}>
          Clear all
        </Button>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          disabled={incomplete}
          onClick={() => {
            onApply(draft)
            onClose()
          }}
        >
          {incomplete ? 'Pick a date' : 'Show leads'}
        </Button>
      </Dialog.Footer>
    </>
  )
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-2.5 flex items-baseline gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
        {title}
        {hint && <span className="font-normal normal-case tracking-normal">· {hint}</span>}
      </h3>
      {children}
    </section>
  )
}

/** A row of single-choice chips ('' = any). */
function Chips({ label, showLabel, value, choices, onPick }: { label: string; showLabel?: boolean; value: string; choices: { value: string; label: string }[]; onPick: (v: string) => void }) {
  return (
    <div className={cn(showLabel && 'flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3')}>
      {showLabel && <span className="w-20 shrink-0 text-[12.5px] font-medium text-[var(--text-h)]">{label}</span>}
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
        {choices.map((c) => {
          const on = c.value === value
          return (
            <button
              key={c.value || 'any'}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onPick(c.value)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-colors',
                on
                  ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                  : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:border-[var(--accent-border)] hover:bg-[var(--accent-bg)]',
              )}
            >
              {c.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function selectClass(value: string) {
  return cn(SELECT_CLASS, value && 'border-[var(--accent-border)] bg-[var(--accent-bg)] font-medium')
}

/** A labelled dropdown with a ✕ that clears just this field once it is set. */
function SelectField({ label, value, onClear, children }: { label: string; value: string; onClear: () => void; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="mb-1 flex h-5 items-center justify-between">
        <span className="text-[12.5px] font-medium text-[var(--text-h)]">{label}</span>
        {value && (
          <button type="button" onClick={onClear} aria-label={`Clear ${label}`} title={`Clear ${label}`} className="rounded p-0.5 text-[var(--text-muted)] hover:text-[var(--text-h)]">
            <X size={13} />
          </button>
        )}
      </div>
      {children}
    </div>
  )
}

/** `noneText` null = no "has none" choice. */
function IdSelect({ label, anyText, noneText, value, options, onChange }: { label: string; anyText: string; noneText: string | null; value: string; options: Option[]; onChange: (v: string) => void }) {
  return (
    <SelectField label={label} value={value} onClear={() => onChange('')}>
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className={selectClass(value)}>
        <option value="">{anyText}</option>
        {noneText !== null && <option value={NONE}>{noneText}</option>}
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </SelectField>
  )
}
