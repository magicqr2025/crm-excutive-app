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

/** The public booking pages are served by the admin web app. */
export function publicBookingOrigin(): string {
  const configured = (import.meta.env.VITE_PUBLIC_BOOKING_URL as string | undefined) || (import.meta.env.VITE_WEB_APP_URL as string | undefined)
  return (configured || 'https://waycrm.magicbolt.in').replace(/\/$/, '')
}

export const publicBookingPath = (slug: string, username: string, linkSlug: string): string => `${publicBookingOrigin()}/book/${slug}/${username}/${linkSlug}`
