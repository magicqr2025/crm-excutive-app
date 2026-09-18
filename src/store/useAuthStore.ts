import { create } from 'zustand'
import { staffLogin, staffMe, staffLogout } from '@/lib/staffAuthClient'
import { getCrmSessionToken } from '@/lib/crmSessionClient'

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
  hydrated: boolean
  login: (payload: LoginPayload) => Promise<void>
  hydrate: () => Promise<void>
  logout: () => void
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

export const useAuthStore = create<AuthState>((set, get) => ({
  user: loadStoredUser(),
  businesses: loadStoredBusinesses(),
  activeBusinessId: loadStoredBusinesses()[0]?.id ?? null,
  isAuthenticated: false,
  hydrated: false,

  login: async (payload) => {
    await staffLogin(payload)
    const me = await staffMe()
    const user = toAuthUser(me)
    const businesses = toAuthBusinesses(me)
    persistSession(user, businesses)
    set({ user, businesses, activeBusinessId: businesses[0]?.id ?? null, isAuthenticated: true, hydrated: true })
  },

  hydrate: async () => {
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
        hydrated: true,
      })
    } catch {
      staffLogout()
      clearSession()
      set({ user: null, businesses: [], activeBusinessId: null, isAuthenticated: false, hydrated: true })
    }
  },

  logout: () => {
    staffLogout()
    clearSession()
    set({ user: null, businesses: [], activeBusinessId: null, isAuthenticated: false })
  },
}))
