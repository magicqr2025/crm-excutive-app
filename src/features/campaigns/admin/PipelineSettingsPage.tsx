import type { ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { List, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { PageLoader } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/useToast'
import type { PipelineAgent } from '@/api/pipelineApi'
import { formatDate } from '@/lib/dateFormat'
import { Section, TeamHeader, ToggleRow } from '@/features/team/teamParts'
import { useTeam } from '@/features/team/teamQueries'
import { errorText, staffName } from '@/features/team/teamUtils'
import { DISTRIBUTIONS, PRIORITIES, offReason, routingSentence } from './pipelineText'
import { usePipeline, usePipelineAgents, useSetPipelineAgent } from './pipelineQueries'

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="shrink-0 text-[12.5px] text-[var(--text-muted)]">{label}</dt>
      <dd className="min-w-0 break-words text-right text-[13.5px] font-medium text-[var(--text-h)]">{children}</dd>
    </div>
  )
}

export function PipelineSettingsPage() {
  const { campaignId = '' } = useParams<{ campaignId: string }>()
  const navigate = useNavigate()
  const pipeline = usePipeline(campaignId)
  const agents = usePipelineAgents(campaignId)
  const team = useTeam()
  const data = pipeline.data

  const nameOf = (id: string) => {
    const member = team.data?.find((m) => m.user_id === id)
    return member ? staffName(member) : team.isLoading ? '…' : 'Unknown staff'
  }
  const priority = PRIORITIES.find((p) => p.value === data?.priority)
  const mode = DISTRIBUTIONS.find((d) => d.value === data?.distribution_mode)

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <TeamHeader
        title={data?.name ?? 'Pipeline settings'}
        subtitle="Pipeline settings"
        backTo="/campaigns"
        action={
          data && (
            <Button onClick={() => navigate(`/campaigns/${campaignId}/edit`)}>
              <Pencil size={14} /> Edit
            </Button>
          )
        }
      />
      {pipeline.isLoading ? (
        <PageLoader />
      ) : !data ? (
        <p className="px-4 py-10 text-center text-[13px] text-[var(--text-muted)]">{pipeline.error ? errorText(pipeline.error) : 'Pipeline not found.'}</p>
      ) : (
        <div className="mx-auto grid w-full max-w-5xl gap-4 px-4 pb-10 pt-4 md:px-6 lg:grid-cols-2 lg:items-start">
          <Section title="About this pipeline" hint="Change these with Edit.">
            <dl className="divide-y divide-[var(--border)]">
              <Fact label="Manager">{data.manager_id ? nameOf(data.manager_id) : 'Not set'}</Fact>
              <Fact label="Priority">{priority?.label ?? data.priority}</Fact>
              <Fact label="Lead distribution">{mode?.label ?? data.distribution_mode}</Fact>
              <Fact label="Staff">{data.agent_ids.length ? data.agent_ids.map(nameOf).join(', ') : 'Nobody yet'}</Fact>
              <Fact label="Leads">{data.lead_count.toLocaleString('en-IN')}</Fact>
              <Fact label="Duplicates">Checked across all pipelines; ignored</Fact>
              {data.created_at && <Fact label="Created">{formatDate(data.created_at)}</Fact>}
            </dl>
            <Button variant="secondary" className="w-full justify-center" onClick={() => navigate(`/campaigns/${campaignId}/leads`)}>
              <List size={15} /> View leads
            </Button>
          </Section>

          <Section title="Who gets new leads" hint="Each switch saves at once. Leads people already have never move.">
            {agents.isLoading ? (
              <PageLoader />
            ) : agents.isError ? (
              <div className="space-y-2 text-center">
                <p className="text-[13px] text-[var(--error)]">{errorText(agents.error)}</p>
                <Button variant="secondary" size="sm" onClick={() => void agents.refetch()}>
                  Try again
                </Button>
              </div>
            ) : (
              <Receiving pipelineId={campaignId} mode={data.distribution_mode} agents={agents.data ?? []} />
            )}
          </Section>
        </div>
      )}
    </div>
  )
}

function Receiving({ pipelineId, mode, agents }: { pipelineId: string; mode: Parameters<typeof routingSentence>[0]; agents: PipelineAgent[] }) {
  const toast = useToast()
  const setEnabled = useSetPipelineAgent(pipelineId)
  const receiving = agents.filter((a) => a.takes_new_leads !== false).length

  if (agents.length === 0) return <p className="text-[13px] text-[var(--text-muted)]">This pipeline has no staff yet. Add some with Edit.</p>

  function toggle(agent: PipelineAgent, enabled: boolean) {
    const name = agent.agent_name || 'Staff member'
    setEnabled.mutate(
      { userId: agent.agent_id, enabled },
      {
        onSuccess: () => toast.show({ title: enabled ? `${name} is switched on for this pipeline` : `${name} won’t get new leads in this pipeline`, tone: 'success' }),
        onError: (err) => toast.show({ title: errorText(err), tone: 'error' }),
      },
    )
  }

  return (
    <>
      <p className="rounded-xl bg-[var(--accent-bg)] px-3 py-2.5 text-[12.5px] text-[var(--text-h)]">
        <span className="font-semibold">
          {receiving} of {agents.length} receiving.
        </span>{' '}
        {routingSentence(mode, receiving)}
      </p>
      <div className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)]">
        {agents.map((agent) => (
          <ToggleRow
            key={agent.agent_id}
            title={agent.agent_name || 'Unnamed'}
            // The switch is this pipeline only; leave and "leads off" are set per person and apply everywhere.
            text={offReason(agent) ?? 'Receiving new leads'}
            checked={agent.pipeline_enabled !== false}
            disabled={setEnabled.isPending}
            onChange={(enabled) => toggle(agent, enabled)}
          />
        ))}
      </div>
      <p className="text-[12px] text-[var(--text-muted)]">The switch works for this pipeline only. “On leave” and “Leads off” are changed under Admin → Staff.</p>
    </>
  )
}
