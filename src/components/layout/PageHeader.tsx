import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  action?: ReactNode
}

export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-[var(--border)] px-6 py-4">
      <div className="min-w-0">
        <h1 className="text-[19px] font-semibold text-[var(--text-h)]">{title}</h1>
        {subtitle && <p className="mt-0.5 truncate text-[13px] text-[var(--text-muted)]">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  )
}
