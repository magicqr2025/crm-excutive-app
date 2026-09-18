import { Routes, Route, Navigate } from 'react-router-dom'
import { LoginPage } from '@/features/auth/LoginPage'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { ToastProvider } from '@/components/ui/ToastProvider'

export default function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireAuth />}>
          <Route path="/campaigns" element={<div className="p-6">Campaigns placeholder</div>} />
        </Route>
        <Route path="*" element={<Navigate to="/campaigns" replace />} />
      </Routes>
    </ToastProvider>
  )
}
