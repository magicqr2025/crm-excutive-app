import { useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'
import { PageLoader } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/useToast'
import type { Pipeline, PipelineInput } from '@/api/pipelineApi'
import type { TeamMember } from '@/api/teamApi'
import { SaveBar, Section, TeamHeader } from '@/features/team/teamParts'
import { useTeam } from '@/features/team/teamQueries'
import { SELECT_CLASSES, errorText, staffName } from '@/features/team/teamUtils'
import { cn } from '@/lib/utils'
import { DISTRIBUTIONS, PRIORITIES } from './pipelineText'
import { usePipeline, useSavePipeline } from './pipelineQueries'

/** Create a pipeline (/campaigns/new) or edit one (/campaigns/:campaignId/edit). */
export function PipelineFormPage() {
  const { campaignId = '' } = useParams<{ campaignId: string }>()
  const editing = !!campaignId
  const team = useTeam()
  const pipeline = usePipeline(campaignId)
  // The form copies these values once, so it waits for a fresh read instead of starting from a cached one.
  const loading = team.isLoading || (editing && !pipeline.isFetchedAfterMount && !pipeline.isError)
  const failed = team.error ?? (editing ? pipeline.error : null)

  return (
    <div className="flex h-full flex-col">
      <TeamHeader
        title={editing ? 'Edit pipeline' : 'New pipeline'}
        subtitle={editing ? pipeline.data?.name : 'Set up where leads go and who works them.'}
        backTo={editing ? `/campaigns/${campaignId}/settings` : '/campaigns'}
      />
      {loading ? (
        <PageLoader />
      ) : failed || (editing && !pipeline.data) ? (
        <p className="px-4 py-10 text-center text-[13px] text-[var(--text-muted)]">{failed ? errorText(failed) : 'Pipeline not found.'}</p>
      ) : (
        <PipelineForm key={campaignId || 'new'} pipeline={editing ? pipeline.data! : null} team={team.data ?? []} />
      )}
    </div>
  )
}

function PipelineForm({ pipeline, team }: { pipeline: Pipeline | null; team: TeamMember[] }) {
  const navigate = useNavigate()
  const toast = useToast()
  const save = useSavePipeline(pipeline?.id ?? null)
  // What the form started from, so only real changes are sent.
  const [saved] = useState(() => ({
    name: pipeline?.name ?? '',
    managerId: pipeline?.manager_id ?? '',
    agentIds: pipeline?.agent_ids ?? [],
    distributionMode: pipeline?.distribution_mode ?? ('on_demand' as const),
    priority: pipeline?.priority ?? ('medium' as const),
  }))
  const [name, setName] = useState(saved.name)
  const [managerId, setManagerId] = useState(saved.managerId)
  const [agentIds, setAgentIds] = useState<string[]>(saved.agentIds)
  const [mode, setMode] = useState(saved.distributionMode)
  const [priority, setPriority] = useState(saved.priority)
  const [search, setSearch] = useState('')

  const byName = (a: TeamMember, b: TeamMember) => staffName(a).localeCompare(staffName(b))
  // Active staff, plus anyone already on the pipeline so an inactive person can still be taken off.
  const people = team.filter((m) => m.status === '1' || saved.agentIds.includes(m.user_id)).sort(byName)
  const shown = people.filter((m) => staffName(m).toLowerCase().includes(search.trim().toLowerCase()))
  const managers = team.filter((m) => m.status === '1' || m.user_id === saved.managerId).sort(byName)

  const sameStaff = agentIds.length === saved.agentIds.length && agentIds.every((id) => saved.agentIds.includes(id))
  const patch: Partial<PipelineInput> = {
    ...(name.trim() !== saved.name ? { name: name.trim() } : {}),
    ...(managerId !== saved.managerId ? { managerId } : {}),
    ...(!sameStaff ? { agentIds } : {}),
    ...(mode !== saved.distributionMode ? { distributionMode: mode } : {}),
    ...(priority !== saved.priority ? { priority } : {}),
  }
  const changed = Object.keys(patch).length > 0
  const valid = name.trim().length > 0
  const back = () => navigate(pipeline ? `/campaigns/${pipeline.id}/settings` : '/campaigns')

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!valid || save.isPending || (pipeline && !changed)) return
    const input = pipeline ? patch : { name: name.trim(), managerId: managerId || undefined, agentIds, distributionMode: mode, priority }
    save.mutate(input, {
      onSuccess: (result) => {
        toast.show({ title: pipeline ? 'Pipeline updated' : 'Pipeline created', tone: 'success' })
        navigate(`/campaigns/${result.id}/settings`, { replace: true })
      },
      onError: (err) => toast.show({ title: errorText(err), tone: 'error' }),
    })
  }

  return (
    <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-4 md:px-6">
          <Section title="Basics" hint="Name, manager and priority.">
            <Field label="Name *">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ahmedabad 2026" className="h-11" />
            </Field>
            <Field label="Manager" hint={saved.managerId ? 'You can pick another manager.' : 'Optional.'}>
              <select value={managerId} onChange={(e) => setManagerId(e.target.value)} className={SELECT_CLASSES}>
                {/* The server can change a manager but not remove one. */}
                {!saved.managerId && <option value="">No manager</option>}
                {managers.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {staffName(m)}
                  </option>
                ))}
              </select>
            </Field>
            <fieldset>
              <legend className="mb-1.5 text-[13px] font-medium text-[var(--text-h)]">Priority</legend>
              <div className="grid grid-cols-3 gap-2">
                {PRIORITIES.map((p) => (
                  <label
                    key={p.value}
                    className={cn(
                      'flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border text-[13px] font-medium text-[var(--text-h)] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--accent)]',
                      priority === p.value ? 'border-[var(--accent)] bg-[var(--accent-bg)]' : 'border-[var(--border)]',
                    )}
                  >
                    <input type="radio" name="priority" className="sr-only" checked={priority === p.value} onChange={() => setPriority(p.value)} />
                    <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: p.color }} />
                    {p.label}
                  </label>
                ))}
              </div>
            </fieldset>
          </Section>

          <Section title="Staff" hint={`${agentIds.length} selected for this pipeline.`}>
            {people.length > 6 && <Input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search staff…" aria-label="Search staff" className="h-11" />}
            {shown.length === 0 ? (
              <p className="text-[13px] text-[var(--text-muted)]">{people.length === 0 ? 'No active staff. Add staff under Admin first.' : 'No staff match.'}</p>
            ) : (
              <ul className="max-h-72 divide-y divide-[var(--border)] overflow-y-auto rounded-xl border border-[var(--border)]">
                {shown.map((m) => (
                  <li key={m.user_id}>
                    <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2">
                      <input
                        type="checkbox"
                        checked={agentIds.includes(m.user_id)}
                        onChange={(e) => setAgentIds((ids) => (e.target.checked ? [...ids, m.user_id] : ids.filter((id) => id !== m.user_id)))}
                        className="h-4 w-4 accent-[var(--accent)]"
                      />
                      <span className="min-w-0 flex-1 truncate text-[13.5px] text-[var(--text-h)]">{staffName(m)}</span>
                      {m.status !== '1' && <span className="text-[11.5px] text-[var(--text-muted)]">Inactive</span>}
                      {m.is_admin && <span className="text-[11.5px] text-[var(--text-muted)]">Admin</span>}
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Lead distribution" hint="How new leads reach your staff.">
            <fieldset className="space-y-2">
              <legend className="sr-only">Lead distribution</legend>
              {DISTRIBUTIONS.filter((d) => d.value !== 'conditional' || saved.distributionMode === 'conditional').map((d) => (
                <label
                  key={d.value}
                  className={cn('flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-3', mode === d.value ? 'border-[var(--accent)] bg-[var(--accent-bg)]' : 'border-[var(--border)]')}
                >
                  <input type="radio" name="distribution" checked={mode === d.value} onChange={() => setMode(d.value)} className="mt-0.5 h-4 w-4 accent-[var(--accent)]" />
                  <span>
                    <span className="block text-[13.5px] font-semibold text-[var(--text-h)]">{d.label}</span>
                    <span className="block text-[12px] text-[var(--text-muted)]">{d.description}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            <p className="text-[12px] text-[var(--text-muted)]">Duplicates are checked across all pipelines; a duplicate lead is ignored.</p>
          </Section>
        </div>
      </div>

      <SaveBar note={pipeline ? (changed ? 'Unsaved changes' : 'No changes yet') : 'You can change all of this later.'}>
        <Button type="button" variant="secondary" onClick={back} disabled={save.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={!valid || save.isPending || (!!pipeline && !changed)}>
          {save.isPending ? 'Saving…' : pipeline ? 'Save changes' : 'Create pipeline'}
        </Button>
      </SaveBar>
    </form>
  )
}
