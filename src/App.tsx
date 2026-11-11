import { Routes, Route, Navigate } from 'react-router-dom'
import { LoginPage } from '@/features/auth/LoginPage'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { ToastProvider } from '@/components/ui/ToastProvider'
import { AppShell } from '@/components/layout/AppShell'
import { HomePage } from '@/features/home/HomePage'
import { CampaignsPage } from '@/features/campaigns/CampaignsPage'
import { CampaignLeadsPage } from '@/features/campaigns/CampaignLeadsPage'
import { LeadCallingPage } from '@/features/calling/LeadCallingPage'
import { FollowupsPage } from '@/features/followups/FollowupsPage'
import { FollowupDetailPage } from '@/features/followups/FollowupDetailPage'
import { ContactsPage } from '@/features/contacts/ContactsPage'
import { ContactDetailPage } from '@/features/contacts/ContactDetailPage'
import { CallLogsPage } from '@/features/callLogs/CallLogsPage'
import { DealsPage } from '@/features/deals/DealsPage'
import { MeetingsPage } from '@/features/meetings/MeetingsPage'
import { MeetingDetailPage } from '@/features/meetings/MeetingDetailPage'
import { BookingLinksPage } from '@/features/meetings/BookingLinksPage'
import { SubscriptionsPage } from '@/features/subscriptions/SubscriptionsPage'
import { TasksPage } from '@/features/tasks/TasksPage'
import { TaskDetailPage } from '@/features/tasks/TaskDetailPage'
import { TaskFormPage } from '@/features/tasks/TaskFormPage'
import { TicketsPage } from '@/features/tickets/TicketsPage'
import { TicketCreatePage } from '@/features/tickets/TicketCreatePage'
import { TicketDetailPage } from '@/features/tickets/TicketDetailPage'
import { TargetPage } from '@/features/target/TargetPage'
import { PaymentsPage } from '@/features/payments/PaymentsPage'
import { CallRecordingSettingsPage } from '@/features/settings/CallRecordingSettingsPage'
import { InboxPage } from '@/features/inbox/InboxPage'
import { ConversationPage } from '@/features/inbox/ConversationPage'
import { TeamChatPage } from '@/features/teamChat/TeamChatPage'
import { TeamChatThreadPage } from '@/features/teamChat/TeamChatThreadPage'
import { MyPerformancePage } from '@/features/performance/MyPerformancePage'
import { NotificationsPage } from '@/features/notifications/NotificationsPage'

export default function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireAuth />}>
          <Route element={<AppShell />}>
            <Route path="/home" element={<HomePage />} />
            <Route path="/campaigns" element={<CampaignsPage />} />
            <Route path="/campaigns/:campaignId/leads" element={<CampaignLeadsPage />} />
            <Route path="/campaigns/:campaignId/call/:leadId" element={<LeadCallingPage />} />
            <Route path="/contacts" element={<ContactsPage />} />
            <Route path="/contacts/:leadId" element={<ContactDetailPage />} />
            <Route path="/inbox" element={<InboxPage />} />
            <Route path="/inbox/:conversationId" element={<ConversationPage />} />
            <Route path="/followups" element={<FollowupsPage />} />
            <Route path="/followups/:followupId" element={<FollowupDetailPage />} />
            <Route path="/call-logs" element={<CallLogsPage />} />
            <Route path="/deals" element={<DealsPage />} />
            <Route path="/meetings" element={<MeetingsPage />} />
            <Route path="/meetings/links" element={<BookingLinksPage />} />
            <Route path="/meetings/:meetingId" element={<MeetingDetailPage />} />
            <Route path="/subscriptions" element={<SubscriptionsPage />} />
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/tasks/new" element={<TaskFormPage />} />
            <Route path="/tasks/:taskId/edit" element={<TaskFormPage />} />
            <Route path="/tasks/:taskId" element={<TaskDetailPage />} />
            <Route path="/tickets" element={<TicketsPage />} />
            <Route path="/tickets/new" element={<TicketCreatePage />} />
            <Route path="/tickets/:ticketId" element={<TicketDetailPage />} />
            <Route path="/target" element={<TargetPage />} />
            <Route path="/payments" element={<PaymentsPage />} />
            <Route path="/team-chat" element={<TeamChatPage />} />
            <Route path="/team-chat/:channelId" element={<TeamChatThreadPage />} />
            <Route path="/performance" element={<MyPerformancePage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/settings/call-recording" element={<CallRecordingSettingsPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </ToastProvider>
  )
}
