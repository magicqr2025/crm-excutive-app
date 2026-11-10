import { apiRequest } from '@/lib/apiClient'
import { crmSessionAuthHeaders } from '@/lib/crmSessionClient'

// Booking module, staff side: your own booking links and booking a free time for a contact.
// (The public pages an invitee opens live in the admin web app.)

export type LocationType = 'link' | 'phone' | 'in_person'

export interface EventType {
  id: string
  host_user_id: string
  /** the owner's public name, used to build the link's address */
  host_username: string | null
  title: string
  slug: string
  description: string | null
  durations: number[]
  location_type: LocationType
  is_active: boolean
  /** Team link: any executive on it can take a booking; the first to take it hosts it. */
  team_mode: boolean
}

export interface SchedulingProfile {
  slug: string | null
  host: { username: string; display_name: string | null; avatar_url: string | null } | null
}

export interface FreeSlots {
  date: string
  timezone: string
  duration_minutes: number
  slots: { start_utc: string; end_utc: string }[]
}

export interface BookForContactInput {
  contact_id: string
  event_type_id: string
  start_utc: string
  duration?: number
  invitee_timezone?: string
  notes?: string
}

const headers = (): HeadersInit => crmSessionAuthHeaders()

export function fetchEventTypes() {
  return apiRequest<EventType[]>('/scheduling/event-types', { headers: headers() })
}

export function fetchSchedulingProfile() {
  return apiRequest<SchedulingProfile>('/scheduling/profile', { headers: headers() })
}

export function setEventTypeActive(id: string, isActive: boolean) {
  return apiRequest<EventType>(`/scheduling/event-types/${encodeURIComponent(id)}/active`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ is_active: isActive }),
  })
}

export function fetchLinkDays(eventTypeId: string, tz: string, duration?: number) {
  const params = new URLSearchParams({ tz })
  if (duration) params.set('duration', String(duration))
  return apiRequest<{ timezone: string; days: string[] }>(`/scheduling/event-types/${encodeURIComponent(eventTypeId)}/days?${params}`, { headers: headers() })
}

export function fetchLinkSlots(eventTypeId: string, date: string, tz: string, duration?: number) {
  const params = new URLSearchParams({ tz, date })
  if (duration) params.set('duration', String(duration))
  return apiRequest<FreeSlots>(`/scheduling/event-types/${encodeURIComponent(eventTypeId)}/slots?${params}`, { headers: headers() })
}

/** Books the contact into one of the links at a free time; the invite is emailed and a meeting is created. */
export function bookForContact(input: BookForContactInput) {
  return apiRequest<{ id: string }>('/scheduling/bookings', { method: 'POST', headers: headers(), body: JSON.stringify(input) })
}
