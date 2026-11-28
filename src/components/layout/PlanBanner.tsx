import { Lock } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { planNotice } from '@/lib/planAccess'
import { useAuthStore } from '@/store/useAuthStore'

/** Under the header while the plan allows viewing only. */
export function PlanBanner() {
  const access = useAuthStore((s) => s.planAccess)
  const { pathname } = useLocation()
  const notice = planNotice(access, pathname)
  if (!notice) return null
  return (
    <div role="status" className="flex shrink-0 items-start gap-2.5 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--warning)_14%,transparent)] px-4 py-2">
      <Lock size={14} aria-hidden className="mt-0.5 shrink-0 text-[var(--warning)]" />
      <p className="min-w-0 text-[12.5px] leading-snug text-[var(--text)]">
        <span className="font-semibold text-[var(--text-h)]">{notice}.</span> View only: you can look around, but you can’t add or change anything.
      </p>
    </div>
  )
}
