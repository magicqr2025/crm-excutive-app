import { useParams, useSearchParams } from 'react-router-dom'
import { PageLoader } from '@/components/ui/Spinner'
import { MyPerformancePage } from '@/features/performance/MyPerformancePage'
import { useTeam } from '@/features/team/teamQueries'
import { staffName } from '@/features/team/teamUtils'
import { monthFromParams } from './reportMonth'

/** One staff member's report: the same screens they see under My Performance, plus setting their target. */
export function StaffReportPage() {
  const { staffId = '' } = useParams<{ staffId: string }>()
  const [params] = useSearchParams()
  const team = useTeam()
  const member = team.data?.find((m) => m.user_id === staffId)

  if (team.isLoading) return <PageLoader label="Loading staff…" />
  if (!member) {
    return <p className="px-4 py-10 text-center text-[13px] text-[var(--text-muted)]">{team.error instanceof Error ? team.error.message : 'Staff member not found.'}</p>
  }

  const { month, year } = monthFromParams(params)
  return (
    // Keyed so switching person starts fresh.
    <MyPerformancePage
      key={staffId}
      viewing={{
        id: staffId,
        name: staffName(member),
        monthKey: `${year}-${String(month).padStart(2, '0')}`,
        tab: params.get('tab') === 'achievements' ? 'achievements' : 'interactions',
        backTo: `/admin/performance?month=${month}&year=${year}${params.get('tab') === 'achievements' ? '&view=salary' : ''}`,
      }}
    />
  )
}
