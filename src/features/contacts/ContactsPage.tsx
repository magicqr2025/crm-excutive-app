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

  const contacts = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = q
      ? leads.filter((l) => (l.contact_name ?? '').toLowerCase().includes(q) || (l.contact_phone ?? '').includes(q))
      : leads
    return [...filtered].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }, [leads, search])

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[var(--surface)]">
      <PageHeader title="Contacts" subtitle="Every contact assigned to you — tap one to see its history." />
      <div className="space-y-4 p-4">
        <div className="relative max-w-sm">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or phone…" className="pl-8" />
        </div>

        {isLoading ? (
          <p className="text-[13px] text-[var(--text-muted)]">Loading…</p>
        ) : contacts.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-[var(--text-muted)]">
            {search.trim() ? 'No contacts match your search.' : 'No contacts assigned to you yet.'}
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
                {(lead.lead_status || lead.lead_campaigns.length > 0) && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
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
