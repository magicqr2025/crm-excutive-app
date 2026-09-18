import { PageHeader } from '@/components/layout/PageHeader'
import { Avatar } from '@/components/ui/Avatar'
import { useAuthStore } from '@/store/useAuthStore'
import { useMyActiveFollowups } from '@/api/queries'

const STATUS_LABEL: Record<string, string> = { '0': 'Pending', '1': 'Scheduled', '2': 'Done' }

export function FollowupsPage() {
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
          <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
            <table className="w-full text-left text-[12.5px]">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--text-muted)]">
                  <th className="px-4 py-2 font-medium">Contact</th>
                  <th className="px-4 py-2 font-medium">Phone</th>
                  <th className="px-4 py-2 font-medium">Due</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {followups.map((f) => (
                  <tr key={f.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={f.contact_name ?? 'Unknown'} size={28} />
                        <span className="font-medium text-[var(--text-h)]">{f.contact_name ?? 'Unknown'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-[var(--text-muted)]">{f.contact_phone ?? '—'}</td>
                    <td className="px-4 py-2.5 text-[var(--text-muted)]">
                      {f.followup_date} {f.followup_time}
                    </td>
                    <td className="px-4 py-2.5">{STATUS_LABEL[f.followup_status]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
