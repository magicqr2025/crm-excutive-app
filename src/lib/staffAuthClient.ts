import { apiRequest } from './apiClient'
import { setCrmSessionToken, crmSessionAuthHeaders } from './crmSessionClient'

// crmbackend's own local staff login (POST /api/v1/users/login) — separate from
// any boss-identity login. Staff accounts are created by an admin via
// orm-whatsapp's Control Panel > Staff (POST /crm/users) and log in directly
// here.

export interface StaffAuthUser {
  id: string
  email: string
  name: string
  role: string | null
  token: string
}

export interface StaffMeBusiness {
  id: string
  name: string
  role: string
}

export interface StaffMeResponse {
  id: string
  email: string
  name: string
  role: string | null
  businesses: StaffMeBusiness[]
}

export async function staffLogin(payload: { email: string; password: string }): Promise<StaffAuthUser> {
  const auth = await apiRequest<StaffAuthUser>('/api/v1/users/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  setCrmSessionToken(auth.token)
  return auth
}

export async function staffMe(): Promise<StaffMeResponse> {
  return apiRequest<StaffMeResponse>('/api/v1/users/me', {
    headers: crmSessionAuthHeaders(),
  })
}

export function staffLogout() {
  setCrmSessionToken(null)
}
