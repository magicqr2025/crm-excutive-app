// Getting leads into a pipeline and between pipelines. Same endpoints as orm-whatsapp.
import { apiRequest } from '@/lib/apiClient'
import { crmSessionAuthHeaders } from '@/lib/crmSessionClient'

function post<T>(path: string, body: string): Promise<T> {
  return apiRequest<T>(path, { method: 'POST', headers: crmSessionAuthHeaders(), body })
}

export type UploadAssignMode = 'campaign' | 'distribute' | 'single' | 'on_demand'

export interface UploadInput {
  pipelineId: string
  fileName: string
  rows: { name: string; phone: string }[]
  /** The options below apply to this file's leads only. */
  leadStatusId?: string
  labelIds: string[]
  assignMode: UploadAssignMode
  staffIds: string[]
}

/** The request exactly as sent, so its size can be checked before uploading. */
export const uploadBody = (input: UploadInput) =>
  JSON.stringify({
    id: input.pipelineId,
    file_name: input.fileName,
    rows: input.rows,
    ...(input.leadStatusId ? { lead_status_id: input.leadStatusId } : {}),
    ...(input.labelIds.length ? { label_ids: input.labelIds } : {}),
    // "campaign" = the pipeline's own rule, which is what the server does when nothing is sent.
    ...(input.assignMode !== 'campaign' ? { assignment: { mode: input.assignMode, staff_ids: input.staffIds } } : {}),
  })

export const uploadLeads = (input: UploadInput) =>
  post<{ created_count: number; duplicate_count: number }>('/crm/lead-campaigns/upload-leads', uploadBody(input))

export const addExistingLeads = (pipelineId: string, leadIds: string[]) =>
  post<{ allotted_count: number; assigned_count?: number }>('/crm/lead-campaigns/allot-existing-leads', JSON.stringify({ lead_campaign_id: pipelineId, lead_ids: leadIds }))

export type MoveAssignMode = 'follow_destination' | 'keep_same' | 'specific'

export const moveLeads = (input: { leadIds: string[]; destinationId: string; assignMode: MoveAssignMode; staffId?: string; leadStatusId?: string }) =>
  post<{ moved_count: number }>(
    '/crm/lead-campaigns/move-leads',
    JSON.stringify({
      lead_ids: input.leadIds,
      destination_lead_campaign_id: input.destinationId,
      assign_mode: input.assignMode,
      ...(input.staffId ? { assign_to_staff_id: input.staffId } : {}),
      ...(input.leadStatusId ? { lead_status_id: input.leadStatusId } : {}),
    }),
  )
