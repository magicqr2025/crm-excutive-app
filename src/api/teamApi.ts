// Staff and role management (admin only on the server). Same endpoints as orm-whatsapp's Control Panel.
import { apiRequest } from '@/lib/apiClient'
import { crmSessionAuthHeaders } from '@/lib/crmSessionClient'
import { useAuthStore } from '@/store/useAuthStore'

export interface TeamMember {
  user_id: string
  first_name: string | null
  last_name: string | null
  user_email: string | null
  user_phone: string | null
  status: '0' | '1'
  user_role_type_name: string | null
  /** Full access: the business owner, or staff an admin has promoted. */
  is_admin?: boolean
  /** The business owner's own account: always an admin. */
  is_owner?: boolean
  /** On leave: skipped for new leads (the person or an admin can set it). */
  on_leave?: boolean
  /** false = an admin stopped new leads for this person (they aren't told). */
  receives_leads?: boolean
}

export interface TeamRole {
  id: string
  role: string
  /** The role reads everyone's records, not just what is assigned to it. */
  sees_all_data?: boolean
  /** The name contains "manager", which always reads everyone's records. */
  sees_all_by_name?: boolean
}

export type PermissionAction = 'view' | 'add' | 'edit' | 'delete'

export interface RolePermission {
  feature: string
  can_view: boolean
  can_add: boolean
  can_edit: boolean
  can_delete: boolean
  group?: string
  label?: string
  description?: string
  /** Which of the four actions mean something for this feature (all four when absent). */
  actions?: PermissionAction[]
}

export interface NewStaff {
  full_name: string
  email: string
  phone?: string
  password: string
  role_id: string
  is_admin?: boolean
}

export interface StaffPatch {
  full_name?: string
  email?: string
  phone?: string
  role_id?: string
  status?: boolean
  is_admin?: boolean
  password?: string
  /** Only with status: false. A staff id to take over their open leads, or "unassigned". */
  reassign_leads_to?: string
}

function businessId(): string {
  const id = useAuthStore.getState().activeBusinessId
  if (!id) throw new Error('No active business')
  return id
}

function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  return apiRequest<T>(path, { method, headers: crmSessionAuthHeaders(), ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
}

const idPath = (id: string) => encodeURIComponent(id)

export const fetchTeam = () => request<TeamMember[]>('/crm/users/get-list', 'POST', { business_id: businessId(), showInactive: true })

export const createStaff = (input: NewStaff) => request<TeamMember>('/crm/users', 'POST', { ...input, business_id: businessId() })

export const updateStaff = (userId: string, patch: StaffPatch) =>
  request<TeamMember>(`/crm/users/${idPath(userId)}`, 'PUT', { ...patch, business_id: businessId() })

export const setAvailability = (userId: string, patch: { on_leave?: boolean; receives_leads?: boolean }) =>
  request<TeamMember>(`/crm/users/${idPath(userId)}/availability`, 'PUT', patch)

export const fetchRoles = () => request<TeamRole[]>(`/crm/users/roles?business_id=${idPath(businessId())}`)

export const createRole = (role: string) => request<{ id: string; role: string }>('/crm/users/role-types', 'POST', { role })

export const fetchRolePermissions = (roleId: string) => request<RolePermission[]>(`/crm/users/role-types/${idPath(roleId)}/permissions`)

export const saveRolePermissions = (roleId: string, permissions: RolePermission[], seesAllData?: boolean) =>
  request<RolePermission[]>(`/crm/users/role-types/${idPath(roleId)}/permissions`, 'PUT', {
    permissions,
    ...(seesAllData === undefined ? {} : { sees_all_data: seesAllData }),
  })
