import { useState } from 'react'
import { ArrowRightLeft, CalendarClock, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/useToast'
import {
  useCancelMeeting,
  useCompleteMeeting,
  useRescheduleMeeting,
  useStaffList,
  useTransferMeeting,
} from '@/api/queries'
import type { CrmMeeting } from '@/api/crmApi'
import type { MeetingPermissions } from './meetingUi'
import { CompleteMeetingDialog } from './CompleteMeetingDialog'
import { CancelMeetingDialog } from './CancelMeetingDialog'
import { RescheduleMeetingDialog } from './RescheduleMeetingDialog'
import { TransferMeetingDialog } from './TransferMeetingDialog'

type DialogKind = 'complete' | 'cancel' | 'reschedule' | 'transfer' | null

interface MeetingActionsProps {
  meeting: CrmMeeting
  can: MeetingPermissions
}

export function MeetingActions({ meeting, can }: MeetingActionsProps) {
  const [dialog, setDialog] = useState<DialogKind>(null)
  const { show } = useToast()
  const { data: staff = [] } = useStaffList()
  const complete = useCompleteMeeting()
  const cancel = useCancelMeeting()
  const reschedule = useRescheduleMeeting()
  const transfer = useTransferMeeting()

  const close = () => setDialog(null)
  const outcome = (success: string, failure: string) => ({
    onSuccess: () => {
      show({ title: success, tone: 'success' as const })
      close()
    },
    onError: (err: unknown) => show({ title: err instanceof Error ? err.message : failure, tone: 'error' as const }),
  })

  if (!Object.values(can).some(Boolean)) return null

  return (
    // Dialogs render in a portal but React events still bubble to the card, so stop them here.
    <div className="mt-2 flex flex-wrap gap-1.5" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      {can.complete && (
        <Button size="sm" onClick={() => setDialog('complete')}>
          <Check size={13} /> Complete
        </Button>
      )}
      {can.reschedule && (
        <Button size="sm" variant="secondary" onClick={() => setDialog('reschedule')}>
          <CalendarClock size={13} /> Reschedule
        </Button>
      )}
      {can.transfer && (
        <Button size="sm" variant="secondary" onClick={() => setDialog('transfer')}>
          <ArrowRightLeft size={13} /> Transfer
        </Button>
      )}
      {can.cancel && (
        <Button size="sm" variant="ghost" onClick={() => setDialog('cancel')} className="text-[var(--error)]">
          <X size={13} /> Cancel
        </Button>
      )}

      <CompleteMeetingDialog
        open={dialog === 'complete'}
        onClose={close}
        meeting={meeting}
        staff={staff}
        isSaving={complete.isPending}
        onSubmit={(input) => complete.mutate({ id: meeting.id, input }, outcome('Meeting completed', 'Failed to complete meeting'))}
      />
      <CancelMeetingDialog
        open={dialog === 'cancel'}
        onClose={close}
        isSaving={cancel.isPending}
        onSubmit={(input) => cancel.mutate({ id: meeting.id, input }, outcome('Meeting cancelled', 'Failed to cancel meeting'))}
      />
      <RescheduleMeetingDialog
        open={dialog === 'reschedule'}
        onClose={close}
        currentTime={meeting.meeting_time}
        isSaving={reschedule.isPending}
        onSubmit={(meetingTime) =>
          reschedule.mutate({ id: meeting.id, meetingTime }, outcome('Meeting rescheduled', 'Failed to reschedule meeting'))
        }
      />
      <TransferMeetingDialog
        open={dialog === 'transfer'}
        onClose={close}
        staff={staff}
        currentAssigneeId={meeting.assign_to_staff_id ?? meeting.created_by}
        isSaving={transfer.isPending}
        onSubmit={(input) => transfer.mutate({ id: meeting.id, input }, outcome('Meeting transferred', 'Failed to transfer meeting'))}
      />
    </div>
  )
}
