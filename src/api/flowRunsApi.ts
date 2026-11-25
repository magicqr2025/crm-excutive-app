import { apiRequest } from '@/lib/apiClient'
import { crmSessionAuthHeaders } from '@/lib/crmSessionClient'

// Ported from orm-whatsapp: the automation run history crmbackend keeps at /automation/flow-runs. Every time
// a bot automation ran for a client, the steps it performed and where it stopped.

/** The one word shown for a run. `completed_with_errors` = finished, but a step failed on the way. */
export type RunOutcome = 'completed' | 'completed_with_errors' | 'waiting' | 'failed' | 'running' | 'interrupted'
export type RunTrigger = 'keyword' | 'button_reply' | 'delay' | 'session_reminder' | 'calling_window' | 'voice_call' | 'api'
export type StepStatus = 'ok' | 'failed' | 'waiting' | 'skipped' | 'info'

export interface FlowRunStep {
  id: string
  seq: number
  node_id: string | null
  block_type: string
  title: string
  status: StepStatus
  /** A short code, e.g. WINDOW_CLOSED, that support can quote. */
  error_code: string | null
  /** What to do about it, in plain words. */
  hint: string | null
  message: string | null
  at: string
}

export interface FlowRun {
  id: string
  bot_id: string
  flow_name: string
  trigger: RunTrigger
  trigger_detail: string | null
  contact_id: string | null
  status: 'running' | 'waiting' | 'completed' | 'failed'
  outcome: RunOutcome
  waiting_for: string | null
  waiting_text: string | null
  stopped_step: string | null
  error_code: string | null
  error_message: string | null
  hint: string | null
  failed_steps: number
  started_at: string
  finished_at: string | null
  steps?: FlowRunStep[]
}

/** Every automation run for one client, newest first, each with its steps. */
export function fetchContactFlowRuns(contactId: string): Promise<FlowRun[]> {
  return apiRequest<FlowRun[]>(`/automation/flow-runs/contact/${encodeURIComponent(contactId)}`, { headers: crmSessionAuthHeaders() })
}
