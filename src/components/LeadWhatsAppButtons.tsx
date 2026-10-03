import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
  /** The lead's owner; only the owner sees the Company button. */
  ownerStaffId?: string | null
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
 *  - Company: opens that lead's chat in the Inbox, sent from the business's
 *    connected WhatsApp Business number. Shown only on your own leads, shown with
 *    the company logo when there is one, and greyed out until a number is connected.
 * Renders nothing if the stored number can't be dialled.
 */
export function LeadWhatsAppButtons({ contactId, phone, countryCode, ownerStaffId, className }: LeadWhatsAppButtonsProps) {
  const navigate = useNavigate()
  const { show } = useToast()
  const userId = useAuthStore((s) => s.user?.id ?? '')
  const { entitled, connected, isLoading, logoUrl } = useWhatsappCompanyAccess()
  const startConversation = useStartConversation()
  // Remember which logo URL failed to load, so a broken image falls back to the text button.
  const [failedLogoUrl, setFailedLogoUrl] = useState<string | null>(null)

  const number = buildWhatsAppNumber({ phone, countryCode })
  if (!number) return null

  const showCompany = entitled && !!ownerStaffId && ownerStaffId === userId
  const companyDisabled = isLoading || !connected || startConversation.isPending
  const logo = logoUrl && logoUrl !== failedLogoUrl ? logoUrl : null

  function openCompanyChat() {
    if (startConversation.isPending) return
    startConversation.mutate(contactId, {
      onSuccess: (conversation) => navigate(`/inbox/${conversation.id}`),
      onError: (error) =>
        show({ title: 'Could not open the WhatsApp chat', description: error instanceof Error ? error.message : undefined, tone: 'error' }),
    })
  }

  return (
    <div className={cn('flex shrink-0 items-center gap-1.5', className)}>
      <HoverLabel label="Personal WhatsApp">
        <a
          href={personalWhatsAppUrl(number)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Personal WhatsApp"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[#25D366] text-white hover:bg-[#1ebe5b]"
        >
          <WhatsAppIcon size={20} />
        </a>
      </HoverLabel>
      {showCompany && (
        <HoverLabel label="Company WhatsApp" className={companyDisabled ? 'cursor-not-allowed' : undefined}>
          <button
            type="button"
            onClick={openCompanyChat}
            disabled={companyDisabled}
            aria-label="Company WhatsApp"
            className={cn(
              'relative flex items-center justify-center rounded-full ring-1 ring-[var(--accent-strong)] hover:bg-[var(--accent-bg)] disabled:pointer-events-none disabled:opacity-45',
              logo ? 'h-10 w-10' : 'h-10 gap-1.5 px-3 text-[12px] font-medium text-[var(--accent-strong)]',
            )}
          >
            {logo ? (
              <>
                <img
                  src={logo}
                  alt=""
                  referrerPolicy="no-referrer"
                  onError={() => setFailedLogoUrl(logo)}
                  className="h-full w-full rounded-full object-cover"
                />
                <span className="absolute -bottom-1 -right-1 flex items-center justify-center rounded-full bg-[#25D366] p-[3px] text-white ring-1 ring-[var(--surface)]">
                  <WhatsAppIcon size={10} />
                </span>
              </>
            ) : (
              <>
                <WhatsAppIcon size={16} />
                Company WhatsApp
              </>
            )}
          </button>
        </HoverLabel>
      )}
    </div>
  )
}
