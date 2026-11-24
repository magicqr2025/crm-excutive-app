import { Field, Input } from '@/components/ui/Input'
import { cn } from '@/lib/utils'
import { useLabels, useLeadStatuses, useMyLeadCampaigns } from '@/api/queries'
import { SELECT_CLASS } from '@/features/meetings/meetingUi'
import { FOLLOWUP_DATE_PRESETS, NO_DATE_RANGE, presetRange } from '@/features/followups/followupDateFilter'
import { FOLLOWUP_CHOICES, type ContactPanelFilters } from './contactFilters'

const chipClass = (active: boolean) =>
  cn(
    'h-8 rounded-full border px-3 text-[12.5px] font-medium transition-colors',
    active
      ? 'border-[var(--accent)] bg-[var(--accent-bg)] text-[var(--accent-strong)]'
      : 'border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-h)]',
  )

interface ContactFilterPanelProps {
  value: ContactPanelFilters
  onChange: (next: ContactPanelFilters) => void
  /** Hidden on the Follow-up today / Overdue tabs, which already pick the follow-up. */
  showFollowup: boolean
}

// The Contacts Filter panel: every choice applies at once (no Apply button), tapping a selected chip clears it.
export function ContactFilterPanel({ value, onChange, showFollowup }: ContactFilterPanelProps) {
  const { data: statuses = [] } = useLeadStatuses()
  const { data: pipelines = [] } = useMyLeadCampaigns()
  const { data: labels = [] } = useLabels()
  const set = <K extends keyof ContactPanelFilters>(key: K, v: ContactPanelFilters[K]) => onChange({ ...value, [key]: v })

  return (
    <div className="space-y-3 rounded-xl border border-[var(--border)] p-3">
      {showFollowup && (
        <Field label="Follow-up">
          <div className="flex flex-wrap gap-1.5">
            {FOLLOWUP_CHOICES.map((c) => (
              <button
                key={c.value}
                type="button"
                aria-pressed={value.followup === c.value}
                onClick={() => set('followup', value.followup === c.value ? '' : c.value)}
                className={chipClass(value.followup === c.value)}
              >
                {c.label}
              </button>
            ))}
          </div>
        </Field>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Lead status">
          <select value={value.leadStatusId} onChange={(e) => set('leadStatusId', e.target.value)} className={SELECT_CLASS}>
            <option value="">Any status</option>
            <option value="none">No status</option>
            {[...statuses]
              .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.lead_status}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Pipeline">
          <select value={value.campaignId} onChange={(e) => set('campaignId', e.target.value)} className={SELECT_CLASS}>
            <option value="">Any pipeline</option>
            {pipelines.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Label">
          <select value={value.labelId} onChange={(e) => set('labelId', e.target.value)} className={SELECT_CLASS}>
            <option value="">Any label</option>
            <option value="none">No label</option>
            {labels.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Added">
        <div className="flex flex-wrap gap-1.5">
          {FOLLOWUP_DATE_PRESETS.map((p) => (
            <button
              key={p.value}
              type="button"
              aria-pressed={value.added.preset === p.value}
              onClick={() => set('added', value.added.preset === p.value ? NO_DATE_RANGE : presetRange(p.value, value.added))}
              className={chipClass(value.added.preset === p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </Field>
      {value.added.preset === 'custom' && (
        <div className="flex items-center gap-2">
          <Input
            type="date"
            aria-label="Added from"
            value={value.added.from}
            max={value.added.to || undefined}
            onChange={(e) => set('added', { ...value.added, from: e.target.value })}
            className="min-w-0 flex-1"
          />
          <span className="text-[12.5px] text-[var(--text-muted)]">to</span>
          <Input
            type="date"
            aria-label="Added to"
            value={value.added.to}
            min={value.added.from || undefined}
            onChange={(e) => set('added', { ...value.added, to: e.target.value })}
            className="min-w-0 flex-1"
          />
        </div>
      )}
    </div>
  )
}
