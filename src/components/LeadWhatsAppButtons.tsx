import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Inbox } from 'lucide-react'
import { useToast } from '@/components/ui/useToast'
import { WhatsAppIcon } from '@/components/ui/WhatsAppIcon'
import { useStartConversation, useWhatsappCompanyAccess } from '@/features/inbox/useInbox'
import { buildWhatsAppNumber, personalWhatsAppUrl } from '@/lib/whatsapp'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/useAuthStore'

interface LeadWhatsAppButtonsProps {
  contactId: string
  phone: string | null
  countryCode?: string | null
  /** The lead's owner; the owner (and any admin) sees the Inbox button. */
  ownerStaffId?: string | null
  /** sm: compact icons; bar: full-width labelled buttons for list cards; md (default): the lead page. */
  size?: 'sm' | 'md' | 'bar'
  className?: string
}

/** Instant hover/focus label. Fixed-positioned so a card's overflow can't clip it. */
function HoverLabel({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const show = (el: HTMLElement) => {
    const rect = el.getBoundingClientRect()
    setPos({ x: rect.left + rect.width / 2, y: rect.top })
  }
  return (
    <span
      className={cn('inline-flex', className)}
      onMouseEnter={(e) => show(e.currentTarget)}
      onMouseLeave={() => setPos(null)}
      onFocus={(e) => show(e.currentTarget)}
      onBlur={() => setPos(null)}
    >
      {children}
      {pos && (
        <span
          role="tooltip"
          style={{ left: pos.x, top: pos.y - 6 }}
          className="pointer-events-none fixed z-[100] -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-[var(--text-h)] px-2 py-1 text-[11.5px] font-medium text-[var(--surface)] shadow-lg"
        >
          {label}
        </span>
      )}
    </span>
  )
}

/**
 * Two buttons beside a lead's number:
 *  - Personal: opens WhatsApp for whichever account is logged in on this device.
 *  - Inbox: opens that lead's chat in the Inbox, sent from the business's
 *    connected WhatsApp Business number. Shown on your own leads (admins: every lead),
 *    greyed out until a number is connected.
 * Renders nothing if the stored number can't be dialled.
 */
export function LeadWhatsAppButtons({ contactId, phone, countryCode, ownerStaffId, size = 'md', className }: LeadWhatsAppButtonsProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { show } = useToast()
  const userId = useAuthStore((s) => s.user?.id ?? '')
  const isAdmin = useAuthStore((s) => s.isAdmin)
  const { entitled, connected, isLoading } = useWhatsappCompanyAccess()
  const startConversation = useStartConversation()

  const number = buildWhatsAppNumber({ phone, countryCode })
  if (!number) return null

  // Owners get it on their own leads; admins can open any lead's company chat (the server allows admins too).
  const showCompany = entitled && (isAdmin || (!!ownerStaffId && ownerStaffId === userId))
  const sm = size === 'sm'
  const companyDisabled = isLoading || !connected || startConversation.isPending

  function openCompanyChat() {
    if (startConversation.isPending) return
    startConversation.mutate(contactId, {
      // backTo tells the chat's Back button to return here (Contacts / the lead) instead of the Inbox list.
      onSuccess: (conversation) => navigate(`/inbox/${conversation.id}`, { state: { backTo: `${location.pathname}${location.search}` } }),
      onError: (error) =>
        show({ title: 'Could not open the WhatsApp chat', description: error instanceof Error ? error.message : undefined, tone: 'error' }),
    })
  }

  // Card action bar: two equal, labelled buttons across the card's width.
  if (size === 'bar') {
    const bar = 'flex h-9 w-full items-center justify-center gap-1.5 rounded-xl text-[12.5px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2'
    return (
      <div className={cn('flex w-full items-center gap-2', className)}>
        <HoverLabel label="Opens WhatsApp on this device" className="flex-1">
          <a
            href={personalWhatsAppUrl(number)}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(bar, 'bg-[#25D366]/12 text-[#128C4B] hover:bg-[#25D366] hover:text-white focus-visible:outline-[#25D366] dark:text-[#4ade80]')}
          >
            <WhatsAppIcon size={15} />
            WhatsApp
          </a>
        </HoverLabel>
        {showCompany && (
          <HoverLabel
            label={!isLoading && !connected ? 'No company WhatsApp number connected yet' : 'Open chat in Inbox (company WhatsApp)'}
            className={cn('flex-1', companyDisabled && 'cursor-not-allowed')}
          >
            <button
              type="button"
              onClick={openCompanyChat}
              disabled={companyDisabled}
              className={cn(
                bar,
                'bg-[var(--accent-bg)] text-[var(--accent-strong)] hover:bg-[var(--accent)] hover:text-white focus-visible:outline-[var(--accent)] disabled:pointer-events-none disabled:bg-[var(--surface-hover)] disabled:text-[var(--text-muted)]',
              )}
            >
              <Inbox size={15} strokeWidth={2.2} />
              Inbox
            </button>
          </HoverLabel>
        )}
      </div>
    )
  }

  return (
    <div className={cn('flex shrink-0 items-center gap-1.5', className)}>
      <HoverLabel label="Personal WhatsApp">
        <a
          href={personalWhatsAppUrl(number)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Personal WhatsApp"
          className={cn(
            'flex items-center justify-center rounded-full bg-[#25D366] text-white hover:bg-[#1ebe5b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#25D366]',
            sm ? 'h-8 w-8' : 'h-10 w-10',
          )}
        >
          <WhatsAppIcon size={sm ? 16 : 20} />
        </a>
      </HoverLabel>
      {showCompany && (
        <HoverLabel
          label={!isLoading && !connected ? 'No company WhatsApp number connected yet' : 'Open chat in Inbox (company WhatsApp)'}
          className={companyDisabled ? 'cursor-not-allowed' : undefined}
        >
          <button
            type="button"
            onClick={openCompanyChat}
            disabled={companyDisabled}
            aria-label="Open chat in Inbox"
            className={cn(
              'flex shrink-0 items-center justify-center rounded-full border border-[var(--accent-border)] bg-[var(--accent-bg)] font-semibold text-[var(--accent-strong)] transition-colors hover:border-[var(--accent)] hover:bg-[var(--accent)] hover:text-white disabled:pointer-events-none disabled:border-[var(--border)] disabled:bg-[var(--surface-hover)] disabled:text-[var(--text-muted)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]',
              sm ? 'h-8 gap-1.5 px-3 text-[12px]' : 'h-10 gap-2 px-4 text-[13px]',
            )}
          >
            <Inbox size={sm ? 14 : 17} strokeWidth={2.2} />
            Inbox
          </button>
        </HoverLabel>
      )}
    </div>
  )
}
