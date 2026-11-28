import { useQuery } from '@tanstack/react-query'
import { Avatar } from '@/components/ui/Avatar'
import { useLeadStageTypes, useLeadStatuses } from '@/api/queries'
import { fetchPipelineLeads } from '@/api/pipelineReportsApi'
import { cn } from '@/lib/utils'
import { usePipelineAgents } from '../admin/pipelineQueries'
import { pipelineNumbers } from './performanceData'

/**
 * Admin summary at the top of a pipeline's leads: how far its leads have got, and who holds them.
 * It always describes the whole pipeline, whatever the list below is filtered to.
 */
export function PipelineOverview({
  pipelineId,
  selectedStaffId,
  onPickStaff,
  onPickNotStarted,
}: {
  pipelineId: string
  selectedStaffId: string
  onPickStaff: (staffId: string) => void
  onPickNotStarted: (newStageId: string) => void
}) {
  const leads = useQuery({ queryKey: ['pipeline-overview-leads', pipelineId], queryFn: () => fetchPipelineLeads(pipelineId) })
  const agents = usePipelineAgents(pipelineId)
  const stages = useLeadStageTypes()
  const statuses = useLeadStatuses()

  const ready = !!leads.data && !!stages.data && !!statuses.data
  const numbers = ready
    ? pipelineNumbers([pipelineId], leads.data!, statuses.data!, stages.data!, [], { staffId: '', stageId: '', statusId: '', from: '', to: '' }).get(pipelineId)!
    : null
  const newStageId = stages.data?.find((s) => s.lead_stage.trim().toLowerCase() === 'new')?.id

  if (leads.isError || agents.isError) return null

  return (
    <div className="space-y-2.5">
      <dl className="grid grid-cols-3 gap-2">
        {[
          { label: 'Not started', value: numbers?.notStarted, color: 'var(--error)', pick: newStageId && numbers?.notStarted ? () => onPickNotStarted(newStageId) : undefined },
          { label: 'In progress', value: numbers?.inProgress, color: 'var(--accent)' },
          { label: 'Closed', value: numbers?.closed, color: 'var(--success)' },
        ].map((s) => {
          const body = (
            <>
              <dd className="font-mono-num text-[20px] font-semibold leading-none" style={{ color: s.color }}>
                {s.value ?? '…'}
              </dd>
              <dt className="mt-1 truncate text-[11.5px] text-[var(--text-muted)]">{s.label}</dt>
            </>
          )
          const box = 'rounded-xl bg-[var(--surface)] px-3 py-2.5 text-left ring-1 ring-[var(--border)]'
          return s.pick ? (
            <button key={s.label} type="button" onClick={s.pick} title="Show these leads" className={cn(box, 'hover:bg-[var(--surface-hover)]')}>
              {body}
            </button>
          ) : (
            <div key={s.label} className={box}>
              {body}
            </div>
          )
        })}
      </dl>

      {(agents.data?.length ?? 0) > 0 && (
        <ul className="scrollbar-thin flex gap-2 overflow-x-auto pb-1" aria-label="Leads by staff. Tap one to show only their leads.">
          {agents.data!.map((agent) => {
            const name = agent.agent_name || 'Unnamed'
            const on = selectedStaffId === agent.agent_id
            return (
              <li key={agent.agent_id} className="shrink-0">
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => onPickStaff(on ? '' : agent.agent_id)}
                  className={cn('flex w-48 items-center gap-2.5 rounded-xl p-2.5 text-left ring-1', on ? 'bg-[var(--accent-bg)] ring-[var(--accent)]' : 'bg-[var(--surface)] ring-[var(--border)]')}
                >
                  <Avatar name={name} size={30} />
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold text-[var(--text-h)]">{name}</span>
                    <span className="block text-[11.5px] text-[var(--text-muted)]">
                      {agent.total} leads{agent.uncontacted !== undefined ? ` · ${agent.uncontacted} new` : ''}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
