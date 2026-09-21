import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { useAuthStore } from '@/store/useAuthStore'
import { useMyActiveFollowups } from '@/api/queries'

export const STATUS_LABEL: Record<string, string> = { '0': 'Pending', '1': 'Scheduled', '2': 'Done' }
export const STATUS_TONE: Record<string, 'warning' | 'accent' | 'success'> = { '0': 'warning', '1': 'accent', '2': 'success' }

// followup_date/followup_time come from Postgres `@db.Date`/`@db.Time`
// columns, which carry no timezone of their own. crmbackend has no
// per-business timezone yet and always means India Standard Time — it writes
// the intended IST wall-clock digits into the UTC slot of the DateTime it
// hands Prisma (`new Date('1970-01-01T' + time + 'Z')` in
// followups.controller.js), the same encoding documented and undone by
// crmbackend's leads.service.js `followupInstant()`. To display these as IST
// (not whatever zone the viewer's own browser happens to be in), undo that
// encoding to recover the real UTC instant, then format it in Asia/Kolkata.
const IST_TIME_ZONE = 'Asia/Kolkata'
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000

function toRealInstant(d: Date) {
  return new Date(d.getTime() - IST_OFFSET_MS)
}

export function formatDate(iso: string) {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? iso
    : toRealInstant(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric', timeZone: IST_TIME_ZONE })
}

export function formatTime(iso: string) {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? iso
    : toRealInstant(d).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', timeZone: IST_TIME_ZONE })
}

export function FollowupsPage() {
  const navigate = useNavigate()
  const userId = useAuthStore((s) => s.user?.id ?? '')
  const { data: followups = [], isLoading } = useMyActiveFollowups(userId)

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[var(--surface)]">
      <PageHeader title="Follow-ups" subtitle="Leads due for a follow-up, assigned to you." />
      <div className="p-4">
        {isLoading ? (
          <p className="text-[13px] text-[var(--text-muted)]">Loading…</p>
        ) : followups.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-[var(--text-muted)]">No follow-ups due.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {followups.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => navigate(`/followups/${f.id}`)}
                className="rounded-xl border border-[var(--border)] p-3.5 text-left hover:bg-[var(--surface-hover)]"
              >
                <div className="flex items-center gap-2.5">
                  <Avatar name={f.contact_name ?? 'Unknown'} size={32} />
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-[var(--text-h)]">{f.contact_name ?? 'Unknown'}</p>
                    <p className="text-[12px] text-[var(--text-muted)]">{f.contact_phone ?? '—'}</p>
                  </div>
                </div>
                <p className="mt-2.5 font-mono-num text-[12px] text-[var(--text-muted)]">
                  Due {formatDate(f.followup_date)} · {formatTime(f.followup_time)}
                </p>
                <div className="mt-2">
                  <Badge tone={STATUS_TONE[f.followup_status]}>{STATUS_LABEL[f.followup_status]}</Badge>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
