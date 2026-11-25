import { apiRequest, apiRequestBlob } from '@/lib/apiClient'
import { crmSessionAuthHeaders } from '@/lib/crmSessionClient'

// Ported from orm-whatsapp (subset): a lead's AI voice calls, served by crmbackend's /voice. Every route here
// needs the "AI Calling" (voice_calls) permission; admins always have it.

export type VoiceCallStatus = 'queued' | 'connected' | 'no_answer' | 'busy' | 'failed'

export const VOICE_LANGUAGES = [
  'Assamese', 'Bengali', 'English', 'Gujarati', 'Hindi', 'Kannada', 'Malayalam', 'Marathi', 'Odia', 'Punjabi', 'Sanskrit', 'Tamil', 'Telugu',
] as const
export type VoiceLanguage = (typeof VOICE_LANGUAGES)[number]

export interface VoiceConnectionStatus {
  configured: boolean
  /** false when the server has no public address, so results could not come back */
  webhook_ready: boolean
  call_window: { start: string; end: string; timezone: string }
}

export interface VariableSpec {
  source: string
  value?: string
  fallback?: string
}

/** A "call purpose": which AI agent calls, and with what values. */
export interface VoiceAgent {
  id: string
  name: string
  language: VoiceLanguage | null
  variable_map: Record<string, VariableSpec>
  is_active: boolean
}

export interface VoiceCall {
  id: string
  status: VoiceCallStatus
  retry_attempt: number
  phone: string
  phone_masked: string
  lead_id: string | null
  contact_name: string | null
  agent_name: string | null
  campaign_id: string | null
  campaign_name: string | null
  duration_seconds: number | null
  failure_reason: string | null
  summary: string | null
  sentiment: string | null
  score: number | null
  /** What the client was heard wanting (wants_meeting, not_interested, …). */
  intents: string[]
  has_recording: boolean
  started_at: string | null
  created_at: string
}

export interface CallActionLog {
  rule: string
  action: string
  ok: boolean
  detail: string
}

export interface VoiceCallDetail extends VoiceCall {
  transcript: { role: 'agent' | 'user'; text: string }[] | null
  initial_variables: Record<string, unknown>
  output_variables: Record<string, unknown>
  /** "ai" = the CRM read the transcript; "agent" = values the voice agent returned. */
  analysis_source: 'ai' | 'agent' | null
  meeting_time: string | null
  callback_time: string | null
  actions_log: CallActionLog[]
}

export interface StartCallInput {
  agent_id: string
  lead_id: string
  language?: VoiceLanguage
  variables?: Record<string, string>
}

const auth = (): HeadersInit => crmSessionAuthHeaders()

export const fetchVoiceConnection = () => apiRequest<VoiceConnectionStatus>('/voice/connection', { headers: auth() })
export const fetchVoiceAgents = () => apiRequest<VoiceAgent[]>('/voice/agents', { headers: auth() })
export const fetchLeadVoiceCalls = (leadId: string) => apiRequest<VoiceCall[]>(`/voice/leads/${encodeURIComponent(leadId)}/calls`, { headers: auth() })
export const fetchVoiceCall = (id: string) => apiRequest<VoiceCallDetail>(`/voice/calls/${encodeURIComponent(id)}`, { headers: auth() })
export const startVoiceCall = (input: StartCallInput) =>
  apiRequest<VoiceCall>('/voice/calls', { method: 'POST', headers: auth(), body: JSON.stringify(input) })
/** The recording needs the session header, so it is fetched as a file and played from a local link. */
export const fetchVoiceRecording = (id: string) => apiRequestBlob(`/voice/calls/${encodeURIComponent(id)}/recording`, { headers: auth() })
