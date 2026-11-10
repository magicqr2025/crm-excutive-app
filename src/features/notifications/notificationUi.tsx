import type { ReactNode } from 'react'
import { ArrowRightLeft, Bell, CalendarClock, CalendarDays, LifeBuoy, ListChecks, MessageSquare, RefreshCw } from 'lucide-react'
import { formatDate } from '@/lib/dateFormat'

const ENTITY_ICONS: Record<string, ReactNode> = {
  followup: <CalendarClock size={15} />,
  meeting: <CalendarDays size={15} />,
  booking: <CalendarDays size={15} />,
  booking_unclaimed: <CalendarDays size={15} />,
  availability: <CalendarClock size={15} />,
  task: <ListChecks size={15} />,
  ticket: <LifeBuoy size={15} />,
  subscription: <RefreshCw size={15} />,
  chat: <MessageSquare size={15} />,
  lead: <ArrowRightLeft size={15} />,
}

export const notificationIcon = (entityType: string): ReactNode => ENTITY_ICONS[entityType] ?? <Bell size={15} />

/** Where a notification opens in this app, or null when it has no screen here (e.g. team chat). */
export function notificationRoute(entityType: string, entityId?: string | null): string | null {
  switch (entityType) {
    case 'followup':
      return entityId ? `/followups/${entityId}` : '/followups'
    case 'meeting':
      return entityId ? `/meetings/${entityId}` : '/meetings'
    case 'booking':
    case 'booking_unclaimed':
    case 'availability':
      return '/meetings'
    case 'task':
      return '/tasks'
    case 'ticket':
      return '/tickets'
    case 'subscription':
      return '/subscriptions'
    case 'lead':
      return entityId ? `/contacts/${entityId}` : '/contacts'
    case 'chat':
      return entityId ? `/team-chat/${entityId}` : '/team-chat'
    default:
      return null
  }
}

export function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return formatDate(iso)
}
