import { Mail, Phone } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Spinner } from '@/components/ui/Spinner'
import { LeadWhatsAppButtons } from '@/components/LeadWhatsAppButtons'
import { cn } from '@/lib/utils'

interface LeadHeroProps {
  contactId: string
  name: string
  phone: string | null
  countryCode?: string | null
  /** Stage and status, e.g. "Opportunity" + "Meeting Schedule". */
  stage?: string | null
  status?: string | null
  statusColor?: string | null
  ownerName?: string | null
  /** For the Company WhatsApp button: only the owner gets it. */
  ownerStaffId?: string | null
  unassigned: boolean
  onAssignToMe?: () => void
  onCall?: () => void
  onEmail?: () => void
  isClaiming: boolean
  /** Extra badges (follow-up due, meeting pending…). */
  children?: React.ReactNode
}

/** Who the client is and how to reach them. The Call button is the biggest thing on the page. */
export function LeadHero({
  contactId,
  name,
  phone,
  countryCode,
  stage,
  status,
  statusColor,
  ownerName,
  ownerStaffId,
  unassigned,
  onAssignToMe,
  onCall,
  onEmail,
  isClaiming,
  children,
}: LeadHeroProps) {
  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)] sm:p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Avatar name={name} size={48} />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[20px] font-semibold leading-tight text-[var(--text-h)] sm:text-[22px]">{name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-[var(--text-muted)]">
              {phone && <span className="font-mono-num text-[var(--text)]">{phone}</span>}
              {ownerName && (
                <>
                  <span aria-hidden>·</span>
                  <span>{ownerName}</span>
                </>
              )}
            </div>
            {(status || stage) && (
              <span className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg)] px-2.5 py-1 text-[12px] font-medium text-[var(--text-h)]">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: statusColor || 'var(--accent)' }} />
                <span className="truncate">
                  {stage && <span className="text-[var(--text-muted)]">{stage}</span>}
                  {stage && status && <span className="text-[var(--text-muted)]"> · </span>}
                  {status}
                </span>
              </span>
            )}
            {unassigned && (
              <p className="mt-2 text-[12.5px] text-[var(--text-muted)]">
                Unassigned. Calling assigns this lead to you.{' '}
                {onAssignToMe && (
                  <button
                    type="button"
                    onClick={onAssignToMe}
                    disabled={isClaiming}
                    className="font-semibold text-[var(--accent-strong)] hover:underline disabled:opacity-60"
                  >
                    Assign to me
                  </button>
                )}
              </p>
            )}
            {children && <div className="mt-2 flex flex-wrap gap-1.5">{children}</div>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <LeadWhatsAppButtons contactId={contactId} phone={phone} countryCode={countryCode} ownerStaffId={ownerStaffId} />
          {onEmail && (
            <button
              type="button"
              onClick={onEmail}
              aria-label="Send email"
              title="Send email"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-[var(--accent-strong)] hover:bg-[var(--accent-bg)]"
            >
              <Mail size={17} />
            </button>
          )}
          {phone && onCall && (
            <button
              type="button"
              onClick={onCall}
              disabled={isClaiming}
              aria-label={`Call ${phone}`}
              className={cn(
                'ml-auto inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-6 text-[15px] font-semibold text-[var(--ink)] shadow-[var(--shadow-sm)] transition-colors hover:bg-[var(--accent-strong)] disabled:opacity-60 md:ml-0 md:flex-none',
              )}
            >
              {isClaiming ? <Spinner size={16} /> : <Phone size={17} />}
              {isClaiming ? 'Assigning…' : 'Call'}
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
