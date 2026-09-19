import { Routes, Route, Navigate } from 'react-router-dom'
import { LoginPage } from '@/features/auth/LoginPage'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { ToastProvider } from '@/components/ui/ToastProvider'
import { AppShell } from '@/components/layout/AppShell'
import { CampaignsPage } from '@/features/campaigns/CampaignsPage'
import { CampaignLeadsPage } from '@/features/campaigns/CampaignLeadsPage'
import { LeadCallingPage } from '@/features/calling/LeadCallingPage'
import { FollowupsPage } from '@/features/followups/FollowupsPage'
import { FollowupDetailPage } from '@/features/followups/FollowupDetailPage'
import { CallLogsPage } from '@/features/callLogs/CallLogsPage'
import { DealsPage } from '@/features/deals/DealsPage'
import { MeetingsPage } from '@/features/meetings/MeetingsPage'
import { PaymentsPage } from '@/features/payments/PaymentsPage'

export default function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireAuth />}>
          <Route element={<AppShell />}>
            <Route path="/campaigns" element={<CampaignsPage />} />
            <Route path="/campaigns/:campaignId/leads" element={<CampaignLeadsPage />} />
            <Route path="/campaigns/:campaignId/call/:leadId" element={<LeadCallingPage />} />
            <Route path="/followups" element={<FollowupsPage />} />
            <Route path="/followups/:followupId" element={<FollowupDetailPage />} />
            <Route path="/call-logs" element={<CallLogsPage />} />
            <Route path="/deals" element={<DealsPage />} />
            <Route path="/meetings" element={<MeetingsPage />} />
            <Route path="/payments" element={<PaymentsPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/campaigns" replace />} />
      </Routes>
    </ToastProvider>
  )
}
