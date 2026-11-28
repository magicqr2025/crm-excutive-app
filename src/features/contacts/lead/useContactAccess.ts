import { useAuthStore, useCan } from '@/store/useAuthStore'
import type { CrmLead } from '@/api/crmApi'

/**
 * What the signed-in person may change on a saved contact. crmbackend enforces the same:
 * numbers are the admin's, except that the lead's own staff member (with Leads add) may fill in an empty
 * alternative number; name and email are open to the lead's own staff member with Leads edit.
 */
export function useContactAccess(lead: CrmLead | undefined) {
  const isAdmin = useAuthStore((s) => s.isAdmin)
  const userId = useAuthStore((s) => s.user?.id ?? '')
  const canAddLeads = useCan('leads', 'add')
  const canEditLeads = useCan('leads', 'edit')
  const mine = !!userId && lead?.assign_to_staff_id === userId

  return {
    isAdmin,
    canEditDetails: !!lead && (isAdmin || (mine && canEditLeads)),
    canChangeAlt: !!lead && (isAdmin || (mine && canAddLeads && !lead.contact_alt_phone)),
  }
}
