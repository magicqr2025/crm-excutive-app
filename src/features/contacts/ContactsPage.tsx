import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { useAuthStore } from '@/store/useAuthStore'
import { useMyLeads } from '@/api/queries'

export function ContactsPage() {
  const navigate = useNavigate()
  const userId = useAuthStore((s) => s.user?.id ?? '')
  const { data: leads = [], isLoading } = useMyLeads(userId)
  const [search, setSearch] = useState('')
  // "Unassigned" = leads nobody has taken yet (e.g. new Facebook/WhatsApp leads); first to call or assign gets it.
  const [view, setView] = useState<'all' | 'unassigned'>('all')
  const unassignedCount = useMemo(() => leads.filter((l) => !l.assign_to_staff_id).length, [leads])

  const contacts = useMemo(() => {
    const q = search.trim().toLowerCase()
    const inView = view === 'unassigned' ? leads.filter((l) => !l.assign_to_staff_id) : leads
    const filtered = q
      ? inView.filter((l) => (l.contact_name ?? '').toLowerCase().includes(q) || (l.contact_phone ?? '').includes(q))
      : inView
    return [...filtered].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }, [leads, search, view])

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[var(--surface)]">
      <PageHeader title="Contacts" subtitle="Your contacts plus unassigned ones — tap one to see its history." />
      <div className="space-y-4 p-4">
        <div role="tablist" className="inline-flex rounded-lg border border-[var(--border)] p-0.5">
          {(['all', 'unassigned'] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium ${
                view === v ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-muted)] hover:bg-[var(--surface-hover)]'
              }`}
            >
              {v === 'all' ? 'All contacts' : 'Unassigned'}
              {v === 'all' && (
                <span
                  className={`rounded-full px-1.5 text-[11px] font-semibold ${
                    view === v ? 'bg-white/25 text-white' : 'bg-[var(--surface-hover)] text-[var(--text-h)]'
                  }`}
                >
                  {leads.length}
                </span>
              )}
              {v === 'unassigned' && unassignedCount > 0 && (
                <span className="rounded-full bg-[var(--warning)] px-1.5 text-[11px] font-semibold text-white">{unassignedCount}</span>
              )}
            </button>
          ))}
        </div>
        <p className="text-[12px] text-[var(--text-muted)]">
          {view === 'all'
            ? `Only your contacts (${leads.length - unassignedCount}) plus unassigned ones (${unassignedCount}). Other executives' contacts are not shown.`
            : 'Contacts nobody owns yet. Call or assign one to make it yours.'}
        </p>
        <div className="relative max-w-sm">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or phone…" className="pl-8" />
        </div>

        {isLoading ? (
          <p className="text-[13px] text-[var(--text-muted)]">Loading…</p>
        ) : contacts.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-[var(--text-muted)]">
            {search.trim()
              ? 'No contacts match your search.'
              : view === 'unassigned'
                ? 'No unassigned leads right now. New ones will show up here.'
                : 'No contacts yet.'}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {contacts.map((lead) => (
              <button
                key={lead.id}
                type="button"
                onClick={() => navigate(`/contacts/${lead.id}`)}
                className="rounded-xl border border-[var(--border)] p-3.5 text-left hover:bg-[var(--surface-hover)]"
              >
                <div className="flex items-center gap-2.5">
                  <Avatar name={lead.contact_name ?? 'Unknown'} size={32} />
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-[var(--text-h)]">{lead.contact_name ?? 'Unknown'}</p>
                    <p className="text-[12px] text-[var(--text-muted)]">{lead.contact_phone ?? '—'}</p>
                  </div>
                </div>
                {(lead.lead_status || lead.lead_campaigns.length > 0 || !lead.assign_to_staff_id) && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    {!lead.assign_to_staff_id && <Badge tone="warning">Unassigned</Badge>}
                    {lead.lead_status && <Badge tone="accent">{lead.lead_status}</Badge>}
                    {lead.lead_campaigns.map((campaign) => (
                      <Badge key={campaign.id} tone="neutral">
                        Campaign: {campaign.name}
                      </Badge>
                    ))}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
