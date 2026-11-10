import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Copy, ExternalLink, Share2 } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { PageLoader } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/useToast'
import { useEventTypes, useSchedulingProfile, useSetEventTypeActive } from '@/api/queries'
import type { EventType } from '@/api/schedulingApi'
import { cn } from '@/lib/utils'
import { formatDuration, locationLabel, publicBookingOrigin, publicBookingPath } from './schedulingUi'

/** Your booking links: copy the address to share, open it, or switch a link on or off. */
export function BookingLinksPage() {
  const navigate = useNavigate()
  const { show } = useToast()
  const { data: links = [], isLoading, isError, error } = useEventTypes()
  const { data: profile } = useSchedulingProfile()
  const setActive = useSetEventTypeActive()
  const slug = profile?.slug ?? null

  const addressFor = (link: EventType) => (slug && link.host_username ? publicBookingPath(profile?.public_host, slug, link.host_username, link.slug) : null)

  function copy(text: string, done: string) {
    navigator.clipboard
      .writeText(text)
      .then(() => show({ title: done, tone: 'success' }))
      .catch(() => show({ title: 'Could not copy the link', tone: 'error' }))
  }

  // Opens the phone's share sheet (WhatsApp, SMS, email…). Where the device or browser has none, the link is copied instead.
  async function share(link: EventType, address: string) {
    const data = { title: link.title, text: `Book a meeting with me: ${link.title}`, url: address }
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share(data)
      } catch (err) {
        // Closing the share sheet is not an error.
        if (!(err instanceof DOMException && err.name === 'AbortError')) copy(address, 'Sharing is not available here, so the link was copied')
      }
      return
    }
    copy(address, 'Sharing is not available here, so the link was copied')
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[var(--surface)]">
      <PageHeader
        title="My booking links"
        subtitle="Share a link so leads can book a free time with you"
        action={
          <Button size="sm" variant="secondary" onClick={() => navigate('/meetings')}>
            <ArrowLeft size={14} /> Meetings
          </Button>
        }
      />
      <div className="mx-auto w-full max-w-2xl space-y-3 p-4">
        {slug && (
          <Button size="sm" variant="outline" onClick={() => copy(`${publicBookingOrigin(profile?.public_host)}/book/${slug}`, 'Business page link copied')} className="gap-1.5">
            <Copy size={14} /> Copy business page link
          </Button>
        )}
        {isLoading ? (
          <PageLoader />
        ) : isError ? (
          <p className="py-8 text-center text-[13px] text-[var(--error)]">{error instanceof Error ? error.message : "Couldn't load your booking links."}</p>
        ) : links.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--border)] p-8 text-center text-[13px] text-[var(--text-muted)]">
            You have no booking links yet. Ask your admin to set one up for you.
          </p>
        ) : (
          links.map((link) => {
            const address = addressFor(link)
            return (
              <section key={link.id} className={cn('space-y-3 rounded-xl border border-[var(--border)] p-4', !link.is_active && 'opacity-60')}>
                <div className="min-w-0">
                  <p className="truncate text-[14.5px] font-semibold text-[var(--text-h)]">{link.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-[12.5px] text-[var(--text-muted)]">{link.description || 'No description'}</p>
                </div>
                <div className="flex flex-wrap gap-1.5 text-[11.5px]">
                  {link.durations.map((d) => (
                    <span key={d} className="rounded-md border border-[var(--border)] px-2 py-0.5 text-[var(--text-muted)]">
                      {formatDuration(d)}
                    </span>
                  ))}
                  <span className="rounded-md border border-[var(--border)] px-2 py-0.5 text-[var(--text-muted)]">{locationLabel(link.location_type)}</span>
                  {link.team_mode && <span className="rounded-md bg-[var(--accent-bg)] px-2 py-0.5 text-[var(--accent-strong)]">Team link</span>}
                </div>
                <div className="flex items-center justify-between gap-2 border-t border-[var(--border)] pt-3">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={!address}
                      onClick={() => address && copy(address, 'Booking link copied')}
                      aria-label="Copy booking link"
                      title="Copy booking link"
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-hover)] disabled:opacity-40"
                    >
                      <Copy size={16} />
                    </button>
                    <button
                      type="button"
                      disabled={!address}
                      onClick={() => address && void share(link, address)}
                      aria-label="Share booking link"
                      title="Share booking link"
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-hover)] disabled:opacity-40"
                    >
                      <Share2 size={16} />
                    </button>
                    {address && (
                      <a
                        href={address}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="Open booking page"
                        title="Open booking page"
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"
                      >
                        <ExternalLink size={16} />
                      </a>
                    )}
                  </div>
                  <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-[var(--text-muted)]">
                    <input
                      type="checkbox"
                      checked={link.is_active}
                      disabled={setActive.isPending}
                      onChange={(e) =>
                        setActive.mutate(
                          { id: link.id, isActive: e.target.checked },
                          { onError: (err) => show({ title: err instanceof Error ? err.message : 'Could not update the link', tone: 'error' }) },
                        )
                      }
                    />
                    On
                  </label>
                </div>
              </section>
            )
          })
        )}
      </div>
    </div>
  )
}
