// crmbackend's own session for /crm/users/* and (as of Phase 2) the leads,
// contacts, lead-campaigns, templates, and bots endpoints. Minted by
// POST /crm/users/ensure-self using the boss bearer token, then sent back on
// every subsequent authenticated crmbackend call. Extracted to its own module
// (mirroring bossApiClient.ts's token pattern) so both crmApi.ts and
// automationApi.ts can share one token instead of each keeping its own copy.
const CRM_TOKEN_STORAGE_KEY = 'crm_auth_token'

let crmSessionToken: string | null = localStorage.getItem(CRM_TOKEN_STORAGE_KEY)

export function setCrmSessionToken(token: string | null) {
  crmSessionToken = token
  if (token) {
    localStorage.setItem(CRM_TOKEN_STORAGE_KEY, token)
  } else {
    localStorage.removeItem(CRM_TOKEN_STORAGE_KEY)
  }
}

export function getCrmSessionToken(): string | null {
  return crmSessionToken
}

export function crmSessionAuthHeaders(): HeadersInit {
  return crmSessionToken ? { Authorization: `Bearer ${crmSessionToken}` } : {}
}
