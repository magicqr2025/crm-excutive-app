import { Routes, Route, Navigate } from 'react-router-dom'
import { LoginPage } from '@/features/auth/LoginPage'
import { RequireAuth } from '@/features/auth/RequireAuth'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route path="/campaigns" element={<div className="p-6">Campaigns placeholder</div>} />
      </Route>
      <Route path="*" element={<Navigate to="/campaigns" replace />} />
    </Routes>
  )
}
