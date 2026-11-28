import { create } from 'zustand'
import { staffLogin, staffMe, staffLogout, type FeaturePermission } from '@/lib/staffAuthClient'
import { getCrmSessionToken } from '@/lib/crmSessionClient'
import { ownerLogin, ownerLogout, restoreOwnerSession, getBossToken, clearOwnerSession, ownerSwitchBusiness, type OwnerSession } from '@/lib/ownerAuthClient'
import type { PlanAccess } from '@/lib/planAccess'
import { ApiError } from '@/lib/apiClient'
import { queryClient } from '@/lib/queryClient'
import { teardownPushNotifications } from '@/features/notifications/usePushNotifications'

export interface AuthUser {
  id: string
  email: string
  name: string
  role?: string
}

export interface AuthBusiness {
  id: string
  name: string
  role: string
}

interface LoginPayload {
  email: string
  password: string
}

interface AuthState {
  user: AuthUser | null
  businesses: AuthBusiness[]
  activeBusinessId: string | null
  isAuthenticated: boolean
  /** Signed in through Business Admin (the boss service), not as staff. */
  isOwner: boolean
  /** What the business's plan allows; null until the server has said. */
  planAccess: PlanAccess | null
  /** Staff an admin has promoted: allowed everything. */
  isAdmin: boolean
  /** The role reads everyone's records, not just its own (a manager role). */
  seesAll: boolean
  /** The role's feature grid (view / add / edit / delete per feature); an admin bypasses it. */
  permissions: Record<string, FeaturePermission>
  hydrated: boolean
  /** Staff login (crmbackend). */
  login: (payload: LoginPayload) => Promise<void>
  /** Business Admin login (boss service). */
  loginAsOwner: (payload: LoginPayload) => Promise<void>
  /** Owner only. Reloads the app on the chosen business; throws, changing nothing, if it can't be opened. */
  switchBusiness: (businessId: string) => Promise<void>
  hydrate: () => Promise<void>
  logout: () => Promise<void>
}

const USER_STORAGE_KEY = 'exec_auth_user'
const BUSINESSES_STORAGE_KEY = 'exec_auth_businesses'

function loadStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as AuthUser) : null
  } catch {
    return null
  }
}

function loadStoredBusinesses(): AuthBusiness[] {
  try {
    const raw = localStorage.getItem(BUSINESSES_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as AuthBusiness[]) : []
  } catch {
    return []
  }
}

function persistSession(user: AuthUser, businesses: AuthBusiness[]) {
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user))
  localStorage.setItem(BUSINESSES_STORAGE_KEY, JSON.stringify(businesses))
}

function clearSession() {
  localStorage.removeItem(USER_STORAGE_KEY)
  localStorage.removeItem(BUSINESSES_STORAGE_KEY)
}

function toAuthUser(me: Awaited<ReturnType<typeof staffMe>>): AuthUser {
  return { id: me.id, email: me.email, name: me.name, role: me.role ?? undefined }
}

function toAuthBusinesses(me: Awaited<ReturnType<typeof staffMe>>): AuthBusiness[] {
  return me.businesses.map((b) => ({ id: b.id, name: b.name, role: b.role }))
}

/** The signed-in state of a business owner: always an admin, so the role grid doesn't apply. */
function ownerState({ user, businesses, activeBusinessId, planAccess }: OwnerSession) {
  persistSession(user, businesses)
  return { user, businesses, activeBusinessId, planAccess, isOwner: true, isAuthenticated: true, isAdmin: true, seesAll: true, permissions: {}, hydrated: true }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: loadStoredUser(),
  businesses: loadStoredBusinesses(),
  activeBusinessId: loadStoredBusinesses()[0]?.id ?? null,
  isAuthenticated: false,
  isOwner: false,
  planAccess: null,
  isAdmin: false,
  seesAll: false,
  permissions: {},
  hydrated: false,

  loginAsOwner: async (payload) => {
    const session = await ownerLogin(payload)
    queryClient.clear()
    set(ownerState(session))
  },

  switchBusiness: async (businessId) => {
    await ownerSwitchBusiness(businessId)
    // A full reload drops every cached list, page state and listener of the previous business.
    window.location.replace('/home')
  },

  login: async (payload) => {
    clearOwnerSession()
    queryClient.clear()
    await staffLogin(payload)
    const me = await staffMe()
    const user = toAuthUser(me)
    const businesses = toAuthBusinesses(me)
    persistSession(user, businesses)
    set({ user, businesses, activeBusinessId: businesses[0]?.id ?? null, isOwner: false, planAccess: me.plan_access ?? null, isAuthenticated: true, isAdmin: me.is_admin === true, seesAll: me.sees_all === true, permissions: me.permissions ?? {}, hydrated: true })
  },

  hydrate: async () => {
    if (getBossToken()) {
      try {
        set(ownerState(await restoreOwnerSession()))
      } catch (err) {
        // Only a rejected session is thrown away; after a network problem a reload can still restore it.
        if (err instanceof ApiError && err.status === 401) {
          clearOwnerSession()
          staffLogout()
          clearSession()
          set({ user: null, businesses: [], activeBusinessId: null })
        }
        set({ hydrated: true })
      }
      return
    }
    if (!getCrmSessionToken()) {
      set({ hydrated: true })
      return
    }
    try {
      const me = await staffMe()
      const user = toAuthUser(me)
      const businesses = toAuthBusinesses(me)
      persistSession(user, businesses)
      set({
        user,
        businesses,
        activeBusinessId: get().activeBusinessId ?? businesses[0]?.id ?? null,
        isAuthenticated: true,
        isOwner: false,
        planAccess: me.plan_access ?? null,
        isAdmin: me.is_admin === true,
        seesAll: me.sees_all === true,
        permissions: me.permissions ?? {},
        hydrated: true,
      })
    } catch {
      staffLogout()
      clearSession()
      set({ user: null, businesses: [], activeBusinessId: null, isOwner: false, planAccess: null, isAuthenticated: false, isAdmin: false, seesAll: false, permissions: {}, hydrated: true })
    }
  },

  logout: async () => {
    // Before clearing the session — the unregister call needs it.
    await teardownPushNotifications()
    ownerLogout()
    staffLogout()
    clearSession()
    queryClient.clear()
    set({ user: null, businesses: [], activeBusinessId: null, isOwner: false, planAccess: null, isAuthenticated: false, isAdmin: false, seesAll: false, permissions: {} })
  },
}))

/** Whether the signed-in person may do this to this feature: an admin always, otherwise what the role grants. The server is the real gate. */
export function useCan(feature: string, action: keyof FeaturePermission = 'view'): boolean {
  return useAuthStore((s) => s.isAdmin || s.permissions[feature]?.[action] === true)
}

/** True when the role is allowed anything (view, add, edit or delete) on at least one of these features. Same rule as orm-whatsapp's `grantsAny`. */
export function grantsAny(permissions: Record<string, FeaturePermission>, feature: string | string[]): boolean {
  return (Array.isArray(feature) ? feature : [feature]).some((f) => {
    const p = permissions[f]
    return !!p && (p.view === true || p.add === true || p.edit === true || p.delete === true)
  })
}

/** Whether a tile / menu item for these features should show: admins always, otherwise the role must be allowed something on one of them. */
export function useCanAccess(feature: string | string[]): boolean {
  return useAuthStore((s) => s.isAdmin || grantsAny(s.permissions, feature))
}

/** Admins and managers read everyone's records; everyone else only their own. */
export function useIsAdminOrManager(): boolean {
  return useAuthStore((s) => s.isAdmin || s.seesAll)
}
