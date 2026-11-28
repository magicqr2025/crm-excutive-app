import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as teamApi from '@/api/teamApi'

export function useTeam() {
  return useQuery({ queryKey: ['team', 'staff'], queryFn: teamApi.fetchTeam })
}

export function useRoles() {
  return useQuery({ queryKey: ['team', 'roles'], queryFn: teamApi.fetchRoles })
}

export function useRolePermissions(roleId: string) {
  // Not refetched in the background: a refresh while editing must not move the saved state under the admin.
  return useQuery({
    queryKey: ['team', 'role-permissions', roleId],
    queryFn: () => teamApi.fetchRolePermissions(roleId),
    refetchOnWindowFocus: false,
  })
}

/** Anything that changes a person also changes the staff pickers elsewhere and your own leave switch. */
function useRefreshStaff() {
  const queryClient = useQueryClient()
  return () => {
    for (const queryKey of [['team', 'staff'], ['staff-list'], ['my-leave-status']]) void queryClient.invalidateQueries({ queryKey })
  }
}

export function useCreateStaff() {
  const refresh = useRefreshStaff()
  return useMutation({ mutationFn: teamApi.createStaff, onSuccess: refresh })
}

export function useUpdateStaff() {
  const refresh = useRefreshStaff()
  return useMutation({
    mutationFn: ({ userId, patch }: { userId: string; patch: teamApi.StaffPatch }) => teamApi.updateStaff(userId, patch),
    onSuccess: refresh,
  })
}

export function useSetStaffAvailability() {
  const refresh = useRefreshStaff()
  return useMutation({
    mutationFn: ({ userId, patch }: { userId: string; patch: { on_leave?: boolean; receives_leads?: boolean } }) =>
      teamApi.setAvailability(userId, patch),
    onSuccess: refresh,
  })
}

export function useCreateRole() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: teamApi.createRole,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['team', 'roles'] }),
  })
}

export function useSaveRolePermissions(roleId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ permissions, seesAllData }: { permissions: teamApi.RolePermission[]; seesAllData?: boolean }) =>
      teamApi.saveRolePermissions(roleId, permissions, seesAllData),
    onSuccess: (saved) => {
      queryClient.setQueryData(['team', 'role-permissions', roleId], saved)
      return queryClient.invalidateQueries({ queryKey: ['team', 'roles'] })
    },
  })
}
