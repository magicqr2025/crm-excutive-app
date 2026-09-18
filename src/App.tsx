import { Routes, Route, Navigate } from 'react-router-dom'
import { LoginPage } from '@/features/auth/LoginPage'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { ToastProvider } from '@/components/ui/ToastProvider'
import { CampaignsPage } from '@/features/campaigns/CampaignsPage'
import { CampaignLeadsPage } from '@/features/campaigns/CampaignLeadsPage'

export default function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireAuth />}>
          <Route path="/campaigns" element={<CampaignsPage />} />
          <Route path="/campaigns/:campaignId/leads" element={<CampaignLeadsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/campaigns" replace />} />
      </Routes>
    </ToastProvider>
  )
}
