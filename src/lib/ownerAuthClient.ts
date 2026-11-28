import { ApiError, apiRequest } from './apiClient'
import { setCrmSessionToken } from './crmSessionClient'
import type { PlanAccess } from './planAccess'

// Business Admin (owner) login — same flow as orm-whatsapp. The password is checked by the boss service
// (backend.magicqr.in); crmbackend then trades the boss token for its own session (ensure-self), which every
// CRM call uses. Staff login is separate: see staffAuthClient.ts.

const BOSS_BASE_URL = (
  (import.meta.env.VITE_LOGIN_BACKEND_URL as string | undefined)?.trim() || 'https://backend.magicqr.in/api/v1'
).replace(/\/$/, '')

// A saved boss token is also what marks the saved session as an owner's.
const BOSS_TOKEN_STORAGE_KEY = 'exec_boss_token'
// The business last chosen on this device. Kept through logout; ignored if the account doesn't have it.
const BUSINESS_STORAGE_KEY = 'exec_owner_business'

export function getBossToken(): string | null {
  return localStorage.getItem(BOSS_TOKEN_STORAGE_KEY)
}

function setBossToken(token: string | null) {
  if (token) localStorage.setItem(BOSS_TOKEN_STORAGE_KEY, token)
  else localStorage.removeItem(BOSS_TOKEN_STORAGE_KEY)
}

async function bossRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getBossToken()
  let res: Response
  try {
    res = await fetch(`${BOSS_BASE_URL}${path}`, {
      ...options,
      // The Bearer token carries the session; cookies could belong to someone else.
      credentials: 'omit',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        'x-skip-session-cookie': 'true',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    })
  } catch {
    // No answer at all: offline, or the login server doesn't allow this app's address.
    throw new ApiError("Can't reach the login server. Check your internet connection and try again.", 0)
  }

  const body = (await res.json().catch(() => null)) as { success?: boolean; data?: T; message?: string } | null
  if (!res.ok || !body?.success) throw new ApiError(body?.message ?? `Request failed (${res.status})`, res.status)
  return body.data as T
}

interface BossBusiness {
  id: string
  name: string
  createdAt?: string
}

export interface OwnerSession {
  /** The owner's crmbackend user (not the boss user id), so "mine" lists and assignments match. */
  user: { id: string; email: string; name: string; role?: string }
  businesses: { id: string; name: string; role: string }[]
  activeBusinessId: string
  planAccess: PlanAccess | null
}

// A crmbackend session belongs to one business. The saved token is replaced only when this succeeds.
async function ensureSelf(businessId: string) {
  // No `host` is sent: it would update the business's saved agency, which staff logins are checked against.
  const me = await apiRequest<{
    token: string
    user_id: string
    first_name?: string | null
    last_name?: string | null
    user_email?: string | null
    plan_access?: PlanAccess
  }>('/crm/users/ensure-self?cookie=false', {
    method: 'POST',
    headers: { Authorization: `Bearer ${getBossToken()}` },
    body: JSON.stringify({ business_id: businessId }),
  })
  setCrmSessionToken(me.token)
  return me
}

// Loads the owner's businesses and opens a session for the one last chosen here, otherwise the first-created one.
async function openCrmSession(): Promise<OwnerSession> {
  const list = await bossRequest<BossBusiness[]>('/businesses')
  const businesses = [...list]
    .sort((a, b) => (Date.parse(a.createdAt ?? '') || 0) - (Date.parse(b.createdAt ?? '') || 0))
    .map((b) => ({ id: String(b.id), name: b.name, role: 'Business Admin' }))
  if (businesses.length === 0) throw new Error('This account has no business yet. Add one in the web CRM first.')

  const saved = localStorage.getItem(BUSINESS_STORAGE_KEY)
  const activeBusinessId = (businesses.find((b) => b.id === saved) ?? businesses[0]).id
  const me = await ensureSelf(activeBusinessId)

  const email = me.user_email ?? ''
  const name = [me.first_name, me.last_name].filter(Boolean).join(' ') || email
  return { user: { id: me.user_id, email, name, role: 'Business Admin' }, businesses, activeBusinessId, planAccess: me.plan_access ?? null }
}

/** Opens a session for another business. The caller reloads the app afterwards. */
export async function ownerSwitchBusiness(businessId: string): Promise<void> {
  await ensureSelf(businessId)
  localStorage.setItem(BUSINESS_STORAGE_KEY, businessId)
}

export async function ownerLogin(payload: { email: string; password: string }): Promise<OwnerSession> {
  clearOwnerSession()
  setCrmSessionToken(null)
  const auth = await bossRequest<{ token: string }>('/users/login', { method: 'POST', body: JSON.stringify(payload) })
  setBossToken(auth.token)
  try {
    return await openCrmSession()
  } catch (err) {
    // Half a login is no login.
    clearOwnerSession()
    throw err
  }
}

let restoring: Promise<OwnerSession> | null = null

/** On app reopen. Shared while running, so two callers don't each call ensure-self. */
export function restoreOwnerSession(): Promise<OwnerSession> {
  restoring ??= openCrmSession().finally(() => {
    restoring = null
  })
  return restoring
}

export function clearOwnerSession() {
  setBossToken(null)
}

export function ownerLogout() {
  if (!getBossToken()) return
  // The request reads the token before it is cleared; logout doesn't wait for the answer.
  bossRequest('/users/logout', { method: 'POST' }).catch(() => {})
  clearOwnerSession()
}
