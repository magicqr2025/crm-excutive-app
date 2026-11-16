import { useState } from 'react'
import { Check, CheckCheck, Copy, Download, ExternalLink, EyeOff, FileText, ImageOff, LayoutTemplate, MapPin, Music, Phone, SmilePlus, UserRound, Video } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/useToast'
import type { ConversationMessage } from '@/api/inboxApi'
import { formatClock } from './inboxFormat'
import { useMessageMediaUrl, type MessageMediaState } from './useInbox'

function StatusTick({ status }: { status: ConversationMessage['status'] }) {
  if (status === 'failed') return <span className="text-[11px] font-medium text-[var(--error)]">Failed</span>
  if (status === 'read') return <CheckCheck size={14} className="text-[var(--info)]" />
  if (status === 'delivered') return <CheckCheck size={14} className="text-[var(--text-muted)]" />
  return <Check size={14} className="text-[var(--text-muted)]" />
}

/** Grey box in place of an image / video while it loads, or when the file can't be shown. */
function MediaPlaceholder({ state, label, icon }: { state: MessageMediaState; label: string; icon?: React.ReactNode }) {
  const unavailable = state === 'none' || state === 'failed'
  return (
    <div className="mb-1 flex h-28 w-44 flex-col items-center justify-center gap-1 rounded-lg bg-[var(--surface-hover)] text-[12px] text-[var(--text-muted)]">
      {unavailable ? (
        <>
          <ImageOff size={20} />
          {label} not available
        </>
      ) : (
        (icon ?? 'Loading…')
      )}
    </div>
  )
}

// ---- Location / contact cards. The body is the text crmbackend builds in inbox/inboundContent.js:
//   location: "📍 <name>\n<address>\nhttps://maps.google.com/?q=<lat>,<lng>"
//   contacts: "👤 <name>\n<phone>\n<email>…", one block per contact, blocks separated by a blank line

const MAP_LINK = /^https:\/\/maps\.google\.com\/\?q=[-\d.]+,[-\d.]+$/

function LocationCard({ body }: { body: string }) {
  const lines = body.split('\n').map((l) => l.trim()).filter(Boolean)
  const link = lines.find((l) => MAP_LINK.test(l)) ?? null
  const text = lines.filter((l) => l !== link)
  const name = (text[0] ?? '').replace(/^📍\s*/, '') || 'Location'
  const address = text.slice(1).join(', ')
  return (
    <div className="mb-1 flex items-start gap-2.5 rounded-lg bg-[var(--surface-hover)] px-2.5 py-2">
      <MapPin size={20} className="mt-0.5 shrink-0 text-[var(--error)]" />
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-medium leading-snug">{name}</span>
        {address && <span className="mt-0.5 block text-[12px] leading-snug text-[var(--text-muted)]">{address}</span>}
        {link && (
          <a href={link} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-[12.5px] font-medium text-[var(--accent-strong)]">
            <ExternalLink size={13} /> Open in Google Maps
          </a>
        )}
      </span>
    </div>
  )
}

function ContactCards({ body }: { body: string }) {
  const { show } = useToast()
  const contacts = body
    .split(/\n\s*\n/)
    .map((block) => {
      const lines = block.split('\n').map((l) => l.trim()).filter(Boolean)
      const rest = lines.slice(1)
      return {
        name: (lines[0] ?? '').replace(/^👤\s*/, '') || 'Contact',
        phones: rest.filter((l) => !l.includes('@')),
        emails: rest.filter((l) => l.includes('@')),
      }
    })
    .filter((c) => c.name || c.phones.length)

  async function copy(phone: string) {
    try {
      await navigator.clipboard.writeText(phone)
      show({ title: 'Number copied' })
    } catch {
      show({ title: 'Could not copy the number', tone: 'error' })
    }
  }

  return (
    <div className="mb-1 space-y-1.5">
      {contacts.map((c, i) => (
        <div key={i} className="rounded-lg bg-[var(--surface-hover)] px-2.5 py-2">
          <div className="flex items-center gap-2.5">
            <UserRound size={20} className="shrink-0 text-[var(--accent-strong)]" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] font-medium">{c.name}</span>
              {c.phones.map((p) => (
                <span key={p} className="block text-[12px] tabular-nums text-[var(--text-muted)]">
                  {p}
                </span>
              ))}
              {c.emails.map((e) => (
                <span key={e} className="block truncate text-[12px] text-[var(--text-muted)]">
                  {e}
                </span>
              ))}
            </span>
          </div>
          {c.phones[0] && (
            <div className="mt-1.5 flex gap-1.5 border-t border-[var(--border)] pt-1.5">
              <a
                href={`tel:${c.phones[0].replace(/[^\d+]/g, '')}`}
                className="inline-flex flex-1 items-center justify-center gap-1 rounded-md py-1 text-[12.5px] font-medium text-[var(--accent-strong)]"
              >
                <Phone size={13} /> Call
              </a>
              <button
                type="button"
                onClick={() => copy(c.phones[0])}
                className="inline-flex flex-1 items-center justify-center gap-1 rounded-md py-1 text-[12.5px] font-medium text-[var(--accent-strong)]"
              >
                <Copy size={13} /> Copy number
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ---- Reactions ----

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏']

/** 🙂 button beside a customer's message: pick an emoji; picking your current one removes it. */
function ReactionPicker({ current, onPick }: { current: string | null; onPick: (emoji: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative shrink-0 self-center">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="React to this message"
        title="React"
        className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--text-muted)] opacity-35 hover:bg-[var(--surface-hover)] hover:opacity-100"
      >
        <SmilePlus size={14} />
      </button>
      {open && (
        <>
          {/* Tap anywhere else to close (phones have no hover). */}
          <button type="button" aria-label="Close" className="fixed inset-0 z-10 cursor-default" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full left-0 z-20 mb-1 flex gap-0.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-1.5 py-1 shadow-lg">
            {QUICK_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  onPick(emoji === current ? '' : emoji)
                  setOpen(false)
                }}
                title={emoji === current ? 'Remove reaction' : undefined}
                className={cn('flex h-9 w-9 items-center justify-center rounded-full text-[19px]', emoji === current && 'bg-[var(--accent-bg)]')}
              >
                {emoji}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/** `onReact` (only for customer messages while the chat is open) shows the 🙂 reaction button. */
export function MessageBubble({ message, onReact }: { message: ConversationMessage; onReact?: (emoji: string) => void }) {
  const { url: mediaUrl, state: mediaState } = useMessageMediaUrl(message)
  const mediaUnavailable = mediaState === 'none' || mediaState === 'failed'
  const out = message.direction === 'out'
  const hasReaction = Boolean(message.reaction || message.staffReaction)
  const isCard = message.kind === 'location' || message.kind === 'contact'

  return (
    <div className={cn('flex items-center gap-1', out ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'relative max-w-[82%] rounded-2xl px-3 py-2 text-[14px] text-[var(--text-h)]',
          hasReaction && 'mb-3',
          out ? 'rounded-tr-sm bg-[var(--accent-bg)]' : 'rounded-tl-sm border border-[var(--border)] bg-[var(--surface)]',
        )}
      >
        {message.kind === 'template' && (
          <div className="mb-1 flex items-center gap-1 text-[11px] font-medium text-[var(--accent-strong)]">
            <LayoutTemplate size={12} />
            Template
          </div>
        )}

        {message.kind === 'image' &&
          (mediaUrl ? (
            <img src={mediaUrl} alt="" className="mb-1 max-h-64 max-w-full rounded-lg object-contain" />
          ) : (
            <MediaPlaceholder state={mediaState} label="Image" />
          ))}

        {message.kind === 'video' &&
          (mediaUrl ? (
            <video src={mediaUrl} controls className="mb-1 max-h-64 max-w-full rounded-lg" />
          ) : (
            <MediaPlaceholder state={mediaState} label="Video" icon={<Video size={22} />} />
          ))}

        {message.kind === 'audio' &&
          (mediaUrl ? (
            <audio src={mediaUrl} controls className="mb-1 max-w-full" />
          ) : (
            <div className="mb-1 flex items-center gap-2 rounded-lg bg-[var(--surface-hover)] px-2.5 py-2 text-[12.5px] text-[var(--text-muted)]">
              <Music size={16} /> {mediaUnavailable ? 'Voice note not available' : 'Loading…'}
            </div>
          ))}

        {message.kind === 'document' && (
          <a
            href={mediaUrl ?? undefined}
            download={message.mediaFilename ?? undefined}
            target="_blank"
            rel="noreferrer"
            className="mb-1 flex items-center gap-2 rounded-lg bg-[var(--surface-hover)] px-2.5 py-2"
          >
            <FileText size={18} className="shrink-0 text-[var(--accent-strong)]" />
            <span className="min-w-0 flex-1 truncate text-[13px]">{message.mediaFilename || 'Document'}</span>
            {mediaUrl ? (
              <Download size={14} className="shrink-0 text-[var(--text-muted)]" />
            ) : (
              <span className="shrink-0 text-[11px] text-[var(--text-muted)]">{mediaUnavailable ? 'Not available' : 'Loading…'}</span>
            )}
          </a>
        )}

        {message.kind === 'location' && <LocationCard body={message.body} />}
        {message.kind === 'contact' && <ContactCards body={message.body} />}

        {message.kind === 'unsupported' && (
          <div className="flex items-start gap-2 text-[13px] italic text-[var(--text-muted)]">
            <EyeOff size={15} className="mt-0.5 shrink-0" />
            <span>This message type isn't supported in WhatsApp Business (e.g. view-once photo, poll or event). Open WhatsApp on the phone to see it.</span>
          </div>
        )}

        {message.body && !isCard && <p className="whitespace-pre-wrap break-words leading-snug">{message.body}</p>}

        <div className="mt-1 flex items-center justify-end gap-1">
          <span className="text-[10.5px] text-[var(--text-muted)]">{formatClock(message.timestamp)}</span>
          {out && <StatusTick status={message.status} />}
        </div>

        {/* Reactions (the customer's and ours), pinned to the bubble's bottom edge like WhatsApp. */}
        {hasReaction && (
          <span
            title={[message.reaction && `Customer: ${message.reaction}`, message.staffReaction && `You: ${message.staffReaction}`].filter(Boolean).join(' · ')}
            className={cn(
              'absolute -bottom-3 flex h-6 min-w-6 items-center justify-center gap-0.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-1 text-[14px] leading-none shadow-sm',
              out ? 'right-2' : 'left-2',
            )}
          >
            {message.reaction}
            {message.staffReaction && message.staffReaction !== message.reaction && message.staffReaction}
          </span>
        )}
      </div>

      {onReact && <ReactionPicker current={message.staffReaction ?? null} onPick={onReact} />}
    </div>
  )
}
