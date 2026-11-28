// Wording and rules about how a pipeline hands out leads (matches orm-whatsapp).
import type { DistributionMode, PipelineAgent, PipelinePriority } from '@/api/pipelineApi'

export const DISTRIBUTIONS: { value: DistributionMode; label: string; description: string }[] = [
  {
    value: 'on_demand',
    label: 'On Demand',
    description: 'Leads stay unassigned until someone takes one or taps Start Calling; the system then assigns ten at a time.',
  },
  { value: 'equal', label: 'Equal', description: 'Leads are shared equally among all staff in the pipeline.' },
  { value: 'conditional', label: 'Conditional', description: 'Leads are assigned by set conditions.' },
]

export const PRIORITIES: { value: PipelinePriority; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: 'var(--text-muted)' },
  { value: 'medium', label: 'Medium', color: 'var(--warning)' },
  { value: 'high', label: 'High', color: 'var(--error)' },
]

/** Why someone on the pipeline isn't getting new leads, or null when they are. */
export function offReason(agent: PipelineAgent): string | null {
  if (agent.takes_new_leads !== false) return null
  if (agent.on_leave) return 'On leave'
  if (agent.receives_leads === false) return 'Leads off in all pipelines'
  if (agent.pipeline_enabled === false) return 'Off in this pipeline'
  return 'Not receiving'
}

/** What happens to the next new lead. */
export function routingSentence(mode: DistributionMode, receiving: number): string {
  if (receiving === 0) return 'Nobody is receiving right now, so new leads stay unassigned until someone is switched back on.'
  const people = receiving === 1 ? 'the 1 receiving staff member' : `the ${receiving} receiving staff`
  if (mode === 'equal') return receiving === 1 ? 'Every new lead goes to the 1 receiving staff member.' : `Each new lead goes to the next of ${people}, in turn.`
  if (mode === 'on_demand') return `New leads wait unassigned until one of ${people} picks them up.`
  return `New leads go to whichever of ${people} they match.`
}
