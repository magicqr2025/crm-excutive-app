import type { ReactNode } from 'react'
import { Layers, Lock } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { LeadWhatsAppButtons } from '@/components/LeadWhatsAppButtons'
import type { CrmLead } from '@/api/crmApi'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/useAuthStore'

interface LeadCardProps {
  lead: CrmLead
  onOpen: () => void
  /** Bulk-select checkbox (Contacts). Omit to hide it. */
  selection?: { checked: boolean; onToggle: () => void }
  /** Another executive's lead: view-only, no actions (Pipeline list for non-admins). */
  locked?: boolean
  /** Shown as the status chip when the lead has no status yet (e.g. "Fresh Inquiry"). */
  statusFallback?: string
  /** Hide pipeline chips, e.g. on a page that is already one pipeline. */
  hidePipelines?: boolean
  /** Extra lines under the chips (follow-up due, etc.). */
  children?: ReactNode
}

/**
 * The lead card used on Contacts and a pipeline's Leads list.
 * Reads: who + who owns it → status / pipeline / labels → message them (full-width action bar).
 * A div, not a <button>: the WhatsApp links inside can't be nested in one.
 */
export function LeadCard({ lead, onOpen, selection, locked = false, statusFallback, hidePipelines = false, children }: LeadCardProps) {
  const userId = useAuthStore((s) => s.user?.id ?? '')
  const status = lead.lead_status ?? statusFallback ?? null
  const statusColor = lead.lead_status ? lead.lead_status_color || 'var(--accent)' : 'var(--warning)'
  const pipelines = hidePipelines ? [] : lead.lead_campaigns
  const labels = lead.labels ?? []
  const tag = lead.tag_name && !labels.some((l) => l.name === lead.tag_name) ? lead.tag_name : null

  return (
    <div
      role="button"
      tabIndex={locked ? -1 : 0}
      aria-disabled={locked}
      onClick={() => {
        if (!locked) onOpen()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !locked) onOpen()
      }}
      className={cn(
        'group flex h-full flex-col gap-3 rounded-2xl bg-[var(--surface)] p-4 text-left shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-[transform,box-shadow] duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] motion-reduce:transition-none',
        locked
          ? 'cursor-default opacity-75'
          : 'cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-12px_rgba(0,0,0,0.18)] motion-reduce:hover:translate-y-0',
        selection?.checked ? 'ring-2 ring-[var(--accent)]' : 'ring-1 ring-[var(--border)]',
      )}
    >
      <div className="flex items-start gap-3">
        <Avatar name={lead.contact_name ?? 'Unknown'} size={42} />
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="truncate text-[15px] font-semibold leading-tight tracking-[-0.01em] text-[var(--text-h)]">{lead.contact_name ?? 'Unknown'}</p>
          <p className="mt-1 font-mono-num text-[12.5px] text-[var(--text-muted)]">{lead.contact_phone ?? '—'}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {/* Owner: avatar + name, or a dashed "Unassigned" pill. */}
          {lead.assign_to_staff_id ? (
            <span
              title={`Assigned to ${lead.assign_staff_name ?? 'staff'}`}
              className="inline-flex max-w-[110px] items-center gap-1.5 rounded-full bg-[var(--surface-hover)] py-0.5 pl-0.5 pr-2.5 text-[11.5px] font-medium text-[var(--text-h)]"
            >
              <Avatar name={lead.assign_staff_name ?? 'Staff'} size={20} />
              <span className="truncate">{lead.assign_to_staff_id === userId ? 'You' : (lead.assign_staff_name?.split(' ')[0] ?? 'Staff')}</span>
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full border border-dashed border-[var(--warning)] px-2.5 py-0.5 text-[11.5px] font-semibold text-[var(--warning)]">
              Unassigned
            </span>
          )}
          {selection && (
            <input
              type="checkbox"
              checked={selection.checked}
              onChange={selection.onToggle}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              aria-label={`Select ${lead.contact_name ?? 'contact'}`}
              className="h-4 w-4 shrink-0 cursor-pointer accent-[var(--accent)]"
            />
          )}
        </div>
      </div>
      {(status || pipelines.length > 0 || labels.length > 0 || tag) && (
        <div className="flex flex-wrap items-center gap-1.5 text-[11.5px]">
          {/* Status chip is tinted with the status's own colour; pipeline and labels stay neutral. */}
          {status && (
            <span
              className="inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold text-[var(--text-h)]"
              style={{ background: `color-mix(in srgb, ${statusColor} 16%, transparent)` }}
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: statusColor }} />
              <span className="truncate">{status}</span>
            </span>
          )}
          {pipelines.map((campaign) => (
            <span key={campaign.id} title="Pipeline" className="inline-flex max-w-full items-center gap-1 rounded-full bg-[var(--surface-hover)] px-2.5 py-1 text-[var(--text)]">
              <Layers size={11} className="shrink-0 text-[var(--text-muted)]" />
              <span className="truncate">{campaign.name}</span>
            </span>
          ))}
          {[...labels.map((l) => ({ id: l.id, name: l.name })), ...(tag ? [{ id: 'tag', name: tag }] : [])].map((l) => (
            <span key={l.id} title="Label" className="inline-flex max-w-full items-center gap-0.5 rounded-full px-1.5 py-1 text-[var(--text-muted)]">
              <span className="opacity-60">#</span>
              <span className="truncate">{l.name}</span>
            </span>
          ))}
        </div>
      )}
      {children}
      {/* Action bar pinned to the bottom so every card's buttons line up. */}
      <div className="mt-auto" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        {locked ? (
          <p className="flex h-9 items-center justify-center gap-1.5 rounded-xl bg-[var(--surface-hover)] text-[12px] font-medium text-[var(--text-muted)]">
            <Lock size={13} /> View only — another executive's lead
          </p>
        ) : (
          <LeadWhatsAppButtons
            size="bar"
            contactId={lead.contact_id}
            phone={lead.contact_phone}
            countryCode={lead.contact_country_code}
            ownerStaffId={lead.assign_to_staff_id}
          />
        )}
      </div>
    </div>
  )
}
