import { lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { LoginPage } from '@/features/auth/LoginPage'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { ToastProvider } from '@/components/ui/ToastProvider'
import { useAndroidBackButton } from '@/lib/useAndroidBackButton'
import { AppShell } from '@/components/layout/AppShell'

// Pages are loaded on demand so each one ships as its own small JS chunk.
// The <Suspense> boundary lives in AppShell around <Outlet />.
const HomePage = lazy(() => import('@/features/home/HomePage').then((m) => ({ default: m.HomePage })))
const CampaignsPage = lazy(() => import('@/features/campaigns/CampaignsPage').then((m) => ({ default: m.CampaignsPage })))
const CampaignLeadsPage = lazy(() => import('@/features/campaigns/CampaignLeadsPage').then((m) => ({ default: m.CampaignLeadsPage })))
const LeadCallingPage = lazy(() => import('@/features/calling/LeadCallingPage').then((m) => ({ default: m.LeadCallingPage })))
const FollowupsPage = lazy(() => import('@/features/followups/FollowupsPage').then((m) => ({ default: m.FollowupsPage })))
const FollowupDetailPage = lazy(() => import('@/features/followups/FollowupDetailPage').then((m) => ({ default: m.FollowupDetailPage })))
const ContactsPage = lazy(() => import('@/features/contacts/ContactsPage').then((m) => ({ default: m.ContactsPage })))
const ContactDetailPage = lazy(() => import('@/features/contacts/ContactDetailPage').then((m) => ({ default: m.ContactDetailPage })))
const CallLogsPage = lazy(() => import('@/features/callLogs/CallLogsPage').then((m) => ({ default: m.CallLogsPage })))
const DealsPage = lazy(() => import('@/features/deals/DealsPage').then((m) => ({ default: m.DealsPage })))
const MeetingsPage = lazy(() => import('@/features/meetings/MeetingsPage').then((m) => ({ default: m.MeetingsPage })))
const MeetingDetailPage = lazy(() => import('@/features/meetings/MeetingDetailPage').then((m) => ({ default: m.MeetingDetailPage })))
const BookingLinksPage = lazy(() => import('@/features/meetings/BookingLinksPage').then((m) => ({ default: m.BookingLinksPage })))
const SubscriptionsPage = lazy(() => import('@/features/subscriptions/SubscriptionsPage').then((m) => ({ default: m.SubscriptionsPage })))
const LeadBoardPage = lazy(() => import('@/features/leads/LeadBoardPage').then((m) => ({ default: m.LeadBoardPage })))
const TasksPage = lazy(() => import('@/features/tasks/TasksPage').then((m) => ({ default: m.TasksPage })))
const TaskDetailPage = lazy(() => import('@/features/tasks/TaskDetailPage').then((m) => ({ default: m.TaskDetailPage })))
const TaskFormPage = lazy(() => import('@/features/tasks/TaskFormPage').then((m) => ({ default: m.TaskFormPage })))
const TicketsPage = lazy(() => import('@/features/tickets/TicketsPage').then((m) => ({ default: m.TicketsPage })))
const TicketCreatePage = lazy(() => import('@/features/tickets/TicketCreatePage').then((m) => ({ default: m.TicketCreatePage })))
const TicketDetailPage = lazy(() => import('@/features/tickets/TicketDetailPage').then((m) => ({ default: m.TicketDetailPage })))
const TargetPage = lazy(() => import('@/features/target/TargetPage').then((m) => ({ default: m.TargetPage })))
const PaymentsPage = lazy(() => import('@/features/payments/PaymentsPage').then((m) => ({ default: m.PaymentsPage })))
const CallRecordingSettingsPage = lazy(() =>
  import('@/features/settings/CallRecordingSettingsPage').then((m) => ({ default: m.CallRecordingSettingsPage })),
)
const InboxPage = lazy(() => import('@/features/inbox/InboxPage').then((m) => ({ default: m.InboxPage })))
const ConversationPage = lazy(() => import('@/features/inbox/ConversationPage').then((m) => ({ default: m.ConversationPage })))
const TeamChatPage = lazy(() => import('@/features/teamChat/TeamChatPage').then((m) => ({ default: m.TeamChatPage })))
const TeamChatThreadPage = lazy(() => import('@/features/teamChat/TeamChatThreadPage').then((m) => ({ default: m.TeamChatThreadPage })))
const MyPerformancePage = lazy(() => import('@/features/performance/MyPerformancePage').then((m) => ({ default: m.MyPerformancePage })))
const NotificationsPage = lazy(() => import('@/features/notifications/NotificationsPage').then((m) => ({ default: m.NotificationsPage })))

export default function App() {
  useAndroidBackButton()
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
            <Route path="/lead-board" element={<LeadBoardPage />} />
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
