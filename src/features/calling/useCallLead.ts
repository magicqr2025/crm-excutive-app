import { useClaimLead } from '@/api/queries'
import { useToast } from '@/components/ui/useToast'

interface CallTarget {
  leadId: string | null
  phone: string | null
  assignToStaffId?: string | null
}

// Shared "Call" action. Unassigned leads are visible to every executive and the
// first one to call takes the lead: claim it, and only dial once the claim
// succeeds. If another executive got there first, show who has it and don't dial.
export function useCallLead() {
  const claimLead = useClaimLead()
  const { show } = useToast()

  function startCall({ leadId, phone, assignToStaffId }: CallTarget) {
    if (!phone) return
    const dial = () => {
      window.location.href = `tel:${phone}`
    }
    // Only an explicit null means unassigned; undefined = owner not known here (e.g. your own followup).
    if (!leadId || assignToStaffId !== null) {
      dial()
      return
    }
    claimLead.mutate(leadId, {
      onSuccess: () => {
        show({ title: 'Lead assigned to you', tone: 'success' })
        dial()
      },
      onError: (err) => show({ title: err instanceof Error ? err.message : 'Could not assign this lead to you', tone: 'error' }),
    })
  }

  // "Assign to me" without calling — same claim, just no dial.
  function assignToMe(leadId: string) {
    claimLead.mutate(leadId, {
      onSuccess: () => show({ title: 'Lead assigned to you', tone: 'success' }),
      onError: (err) => show({ title: err instanceof Error ? err.message : 'Could not assign this lead to you', tone: 'error' }),
    })
  }

  return { startCall, assignToMe, isClaiming: claimLead.isPending }
}
