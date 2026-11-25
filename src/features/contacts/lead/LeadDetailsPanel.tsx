import type { ReactNode } from 'react'
import { BellOff, CalendarPlus, Copy, Layers, Mail, Megaphone, Package, Pencil, Phone, PhoneForwarded, Tag, UserRound, Users } from 'lucide-react'
import { useToast } from '@/components/ui/useToast'
import type { CrmLead } from '@/api/crmApi'
import { formatDate } from '@/lib/dateFormat'

interface LeadDetailsPanelProps {
  lead: CrmLead
  stage?: string | null
  /** Opens the status / labels / groups editor. */
  onEdit?: () => void
}

/** Everything else about the client. A side column on a wide tablet, a fold-out section below the tabs otherwise. */
export function LeadDetailsPanel({ lead, stage, onEdit }: LeadDetailsPanelProps) {
  const { show } = useToast()

  function copy(text: string) {
    void navigator.clipboard?.writeText(text).then(
      () => show({ title: 'Copied', tone: 'success' }),
      () => show({ title: 'Could not copy', tone: 'error' }),
    )
  }

  const labels = lead.labels ?? []
  const groups = lead.groups ?? []
  const products = lead.products ?? []

  return (
    <div className="space-y-4">
      <Section title="Contact">
        <Row icon={Phone} label="Phone">
          {lead.contact_phone ? (
            <span className="flex items-center gap-1.5">
              <span className="font-mono-num">{lead.contact_phone}</span>
              <button type="button" onClick={() => copy(lead.contact_phone!)} aria-label="Copy phone" className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--surface-hover)]">
                <Copy size={13} />
              </button>
            </span>
          ) : (
            '—'
          )}
        </Row>
        {lead.contact_alt_phone && (
          <Row icon={PhoneForwarded} label="Alt. number">
            <span className="font-mono-num">{lead.contact_alt_phone}</span>
          </Row>
        )}
        <Row icon={Mail} label="Email">
          {lead.contact_email ? <span className="break-all">{lead.contact_email}</span> : '—'}
        </Row>
        <Row icon={CalendarPlus} label="Added">
          {formatDate(lead.created_at)}
        </Row>
        {lead.contact_opted_out_at && (
          <Row icon={BellOff} label="WhatsApp">
            <span className="text-[var(--error)]">Unsubscribed</span>
          </Row>
        )}
      </Section>

      <Section
        title="Lead"
        action={
          onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 text-[12.5px] font-medium text-[var(--text-h)] hover:bg-[var(--surface-hover)]"
            >
              <Pencil size={12} /> Edit
            </button>
          )
        }
      >
        <Row icon={Layers} label="Status">
          {lead.lead_status ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: lead.lead_status_color || 'var(--accent)' }} />
              {stage ? `${stage} · ${lead.lead_status}` : lead.lead_status}
            </span>
          ) : (
            '—'
          )}
        </Row>
        <Row icon={UserRound} label="Owner">
          {lead.assign_staff_name || (lead.assign_to_staff_id ? '—' : 'Unassigned')}
        </Row>
        <Row icon={Megaphone} label="Pipelines">
          <Chips items={lead.lead_campaigns.map((c) => c.name)} empty="None" />
        </Row>
        <Row icon={Tag} label="Labels">
          <Chips items={labels.map((l) => l.name)} empty="No labels" />
        </Row>
        <Row icon={Users} label="Groups">
          <Chips items={groups.map((g) => g.name)} empty="No groups" />
        </Row>
        <Row icon={Package} label="Products">
          <Chips items={products.map((p) => p.name)} empty="None" />
        </Row>
      </Section>
    </div>
  )
}

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="font-mono-num text-[11px] uppercase tracking-[0.14em] text-[var(--text-muted)]">{title}</h2>
        {action}
      </div>
      <dl className="divide-y divide-[var(--border)]">{children}</dl>
    </section>
  )
}

function Row({ icon: Icon, label, children }: { icon: typeof Phone; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2.5 text-[13px]">
      <dt className="flex w-24 shrink-0 items-center gap-2 text-[var(--text-muted)]">
        <Icon size={14} /> {label}
      </dt>
      <dd className="min-w-0 flex-1 text-[var(--text-h)]">{children}</dd>
    </div>
  )
}

function Chips({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) return <span className="text-[var(--text-muted)]">{empty}</span>
  return (
    <span className="flex flex-wrap gap-1">
      {items.map((name, i) => (
        <span key={`${name}-${i}`} className="rounded-full border border-[var(--border)] bg-[var(--bg)] px-2 py-0.5 text-[12px]">
          {name}
        </span>
      ))}
    </span>
  )
}
