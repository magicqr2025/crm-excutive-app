import type { LocationType } from '@/api/schedulingApi'

// Helpers for the booking screens. Times travel as UTC instants; anything shown to a person is formatted
// in the zone that person is in.

export const defaultTimezone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h} h ${m} min` : `${h} h`
}

const LOCATION_LABEL: Record<LocationType, string> = { link: 'Online meeting', phone: 'Phone call', in_person: 'In person' }
export const locationLabel = (type: LocationType): string => LOCATION_LABEL[type] ?? type

export function formatTime(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat('en-IN', { timeZone: timezone, hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(iso))
}

// 'YYYY-MM-DD' for an instant, as that calendar day in `timezone`.
export function todayKeyIn(timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

/**
 * The public booking pages are served by the admin web app on the agency's own domain, which crmbackend reports as
 * `public_host` (so every agency gets its own). This app can't work that out from where it runs — on Android it runs
 * from the phone itself — so the host comes from the server. VITE_PUBLIC_BOOKING_URL overrides it (e.g. for testing),
 * and a built-in address is only the last resort while the profile hasn't loaded.
 */
const FALLBACK_BOOKING_ORIGIN = 'https://waycrm.magicbolt.in'

export function publicBookingOrigin(publicHost?: string | null): string {
  const override = import.meta.env.VITE_PUBLIC_BOOKING_URL as string | undefined
  const host = publicHost?.trim()
  const origin = override || (host ? (/^https?:\/\//i.test(host) ? host : `https://${host}`) : FALLBACK_BOOKING_ORIGIN)
  return origin.replace(/\/$/, '')
}

export const publicBookingPath = (publicHost: string | null | undefined, slug: string, username: string, linkSlug: string): string =>
  `${publicBookingOrigin(publicHost)}/book/${slug}/${username}/${linkSlug}`
