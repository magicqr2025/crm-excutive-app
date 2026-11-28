// Creating and managing sales pipelines (admin only on the server). Same endpoints as orm-whatsapp.
import { apiRequest } from '@/lib/apiClient'
import { crmSessionAuthHeaders } from '@/lib/crmSessionClient'
import { useAuthStore } from '@/store/useAuthStore'

/** "conditional" is only kept for pipelines already set to it; it isn't offered for others. */
export type DistributionMode = 'on_demand' | 'equal' | 'conditional'
export type PipelinePriority = 'low' | 'medium' | 'high'

export interface Pipeline {
  id: string
  name: string
  manager_id: string | null
  agent_ids: string[]
  distribution_mode: DistributionMode
  priority: PipelinePriority
  lead_count: number
  created_at: string
  /** Bulk uploads into this pipeline, newest first. */
  uploaded_files?: { id: string; file_name: string; status: string; created_count: number; duplicate_count: number; created_at: string }[]
}

/** One staff member on a pipeline, and whether new leads reach them. */
export interface PipelineAgent {
  agent_id: string
  agent_name: string | null
  total: number
  /** false = skipped for new leads right now (on leave, leads stopped, or off in this pipeline). */
  takes_new_leads?: boolean
  pipeline_enabled?: boolean
  on_leave?: boolean
  receives_leads?: boolean
}

export interface PipelineInput {
  name: string
  managerId?: string
  agentIds: string[]
  distributionMode: DistributionMode
  priority: PipelinePriority
}

function send<T>(path: string, method: 'POST' | 'PUT', body: unknown): Promise<T> {
  return apiRequest<T>(path, { method, headers: crmSessionAuthHeaders(), body: JSON.stringify(body) })
}

const businessId = () => useAuthStore.getState().activeBusinessId ?? ''

/** Only the fields given are sent, so an edit leaves everything else as it is. */
const fields = (input: Partial<PipelineInput>) => ({
  ...(input.name === undefined ? {} : { name: input.name }),
  ...(input.managerId ? { manager_id: input.managerId } : {}),
  ...(input.agentIds === undefined ? {} : { agent_ids: input.agentIds }),
  ...(input.distributionMode === undefined ? {} : { distribution_mode: input.distributionMode }),
  ...(input.priority === undefined ? {} : { priority: input.priority }),
})

export const fetchPipeline = (id: string) => apiRequest<Pipeline>(`/crm/lead-campaigns/edit?id=${encodeURIComponent(id)}`, { headers: crmSessionAuthHeaders() })

export const createPipeline = (input: PipelineInput) => send<Pipeline>('/crm/lead-campaigns/add', 'POST', { business_id: businessId(), ...fields(input) })

export const updatePipeline = (id: string, patch: Partial<PipelineInput>) => send<Pipeline>('/crm/lead-campaigns/update', 'PUT', { id, ...fields(patch) })

export const fetchPipelineAgents = (id: string) =>
  send<PipelineAgent[]>('/crm/lead-campaigns/agent-distribution', 'POST', { business_id: businessId(), lead_campaign_id: id })

/** Stops or restarts new leads for one person in this pipeline only. Leads they hold stay with them. */
export const setPipelineAgentEnabled = (pipelineId: string, userId: string, enabled: boolean) =>
  send<unknown>('/crm/lead-campaigns/agent-enabled', 'PUT', { lead_campaign_id: pipelineId, user_id: userId, enabled })
