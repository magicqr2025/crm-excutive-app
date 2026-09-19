import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  action?: ReactNode
}

export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-[var(--border)] px-5 py-4 md:px-6">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-1.5 h-4 w-[3px] shrink-0 rounded-full bg-[var(--accent)]" />
        <div className="min-w-0">
          <h1 className="text-[19px] font-semibold leading-tight text-[var(--text-h)]">{title}</h1>
          {subtitle && <p className="mt-0.5 truncate text-[13px] text-[var(--text-muted)]">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  )
}
