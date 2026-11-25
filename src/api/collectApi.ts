import { apiRequest } from '@/lib/apiClient'
import { crmSessionAuthHeaders } from '@/lib/crmSessionClient'

// Ported from orm-whatsapp (subset): payment links from crmbackend's /crm/collect-payments. The client pays by
// UPI / bank on the public pay page and enters the reference; a manager approves it.

export interface PaymentSetup {
  enabled: boolean
  upi_id: string | null
  account_number: string | null
  default_expiry_hours: number
}

export interface PaymentLinkRow {
  id: string
  token: string
  contact_id: string | null
  contact_name: string | null
  amount: number | null
  note: string | null
  expires_at: string | null
  created_at: string
}

export interface CreatePaymentLinkInput {
  contact_id?: string
  amount?: number
  note?: string
  /** hours from now; null = never expires; left out = the business default */
  expires_in_hours?: number | null
}

export function fetchPaymentSetup() {
  return apiRequest<PaymentSetup | null>('/crm/collect-payments/settings', { headers: crmSessionAuthHeaders() })
}

export function createPaymentLink(input: CreatePaymentLinkInput) {
  return apiRequest<PaymentLinkRow>('/crm/collect-payments/links', { method: 'POST', headers: crmSessionAuthHeaders(), body: JSON.stringify(input) })
}
