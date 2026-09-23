import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { ArrowRightLeft, ClipboardEdit, MessageSquareText, PhoneIncoming, PhoneMissed, PhoneOutgoing, Tag, UserPlus } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { useCallLogsForLead, useLeadActivity, useLeadStatuses } from '@/api/queries'
import type { CrmActivityEntry, CrmCallLog, CrmLead } from '@/api/crmApi'
import { formatDate as formatIstDate, formatTime as formatIstTime } from '@/lib/followupFormat'
import { cn } from '@/lib/utils'

type Tab = 'about' | 'timeline'

// created_at / call_time are real UTC instants (unlike followup_date/time,
// which need followupFormat's IST decoding), so plain locale formatting.
function dayLabel(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
}
function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}
function durationLabel(seconds: number | null) {
  if (!seconds) return null
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m ? `${m}m ${s}s` : `${s}s`
}

interface TimelineItem {
  id: string
  at: string
  icon: ReactNode
  iconClass: string
  title: string
  chips?: string[]
  remark?: string | null
  note?: string | null
}

function callLogItem(log: CrmCallLog, statusName: (id: string | null) => string | null): TimelineItem {
  const at = log.call_time ?? log.created_at
  if (log.source === 'device_sync') {
    const duration = durationLabel(log.duration_seconds)
    const answered = Boolean(log.duration_seconds)
    const title =
      log.call_type === 'incoming'
        ? answered ? 'Incoming Answered' : 'Incoming Missed'
        : log.call_type === 'missed'
          ? 'Missed Call'
          : answered ? 'Outgoing Answered' : 'Outgoing Missed'
    const Icon = !answered ? PhoneMissed : log.call_type === 'incoming' ? PhoneIncoming : PhoneOutgoing
    return {
      id: `call-${log.id}`,
      at,
      icon: <Icon size={13} />,
      iconClass: answered ? 'bg-[var(--success)]' : 'bg-[var(--error)]',
      title: `${title}${duration ? ` · ${duration}` : ''}`,
    }
  }
  const connected = log.outcome === 'connected'
  const status = statusName(log.lead_status_id)
  return {
    id: `call-${log.id}`,
    at,
    icon: <ClipboardEdit size={13} />,
    iconClass: connected ? 'bg-[var(--success)]' : 'bg-[var(--error)]',
    title: `Lead Disposed | ${connected ? 'Connected' : 'Not Connected'}`,
    chips: [status, log.reason].filter((c): c is string => Boolean(c)),
    remark: log.remark,
    note: log.followup_date
      ? `Follow-up: ${formatIstDate(log.followup_date)}${log.followup_time ? ` ${formatIstTime(log.followup_time)}` : ''}`
      : null,
  }
}

const ACTIVITY_ICON: Record<string, ReactNode> = {
  discussion: <MessageSquareText size={13} />,
  transfer: <ArrowRightLeft size={13} />,
  label: <Tag size={13} />,
  campaign: <ArrowRightLeft size={13} />,
}

function activityItem(entry: CrmActivityEntry): TimelineItem {
  return {
    id: `activity-${entry.id}`,
    at: entry.created_at,
    icon: ACTIVITY_ICON[entry.kind] ?? <MessageSquareText size={13} />,
    iconClass: 'bg-[var(--info)]',
    title: entry.summary,
  }
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[130px_1fr] gap-2 py-1.5 text-[13px]">
      <span className="text-[var(--text-muted)]">{label}</span>
      <span className="min-w-0 break-words text-[var(--text-h)]">{value || '—'}</span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-b border-[var(--border)] px-4 py-3 last:border-b-0">
      <p className="mb-1 text-[13px] font-semibold text-[var(--text-h)]">{title}</p>
      {children}
    </div>
  )
}

// Lead history shown while calling: "About" (the lead's details) and
// "Timeline" (every disposition, device call and activity entry, newest first).
export function LeadHistoryPanel({ lead }: { lead: CrmLead }) {
  const [tab, setTab] = useState<Tab>('timeline')
  const { data: callLogs = [], isLoading: loadingCalls } = useCallLogsForLead(lead.id)
  const { data: activity = [], isLoading: loadingActivity } = useLeadActivity(lead.id)
  const { data: statuses = [] } = useLeadStatuses()

  const groups = useMemo(() => {
    const statusName = (id: string | null) => statuses.find((s) => s.id === id)?.lead_status ?? null
    const items: TimelineItem[] = [
      ...callLogs.map((log) => callLogItem(log, statusName)),
      ...activity.map(activityItem),
      {
        id: 'created',
        at: lead.created_at,
        icon: <UserPlus size={13} />,
        iconClass: 'bg-[var(--accent)]',
        title: 'Lead Created',
      },
    ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())

    const byDay: { day: string; items: TimelineItem[] }[] = []
    for (const item of items) {
      const day = dayLabel(item.at)
      const last = byDay[byDay.length - 1]
      if (last && last.day === day) last.items.push(item)
      else byDay.push({ day, items: [item] })
    }
    return byDay
  }, [callLogs, activity, statuses, lead.created_at])

  const latestRemark = callLogs.find((log) => log.remark)

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border)]">
      <div className="grid grid-cols-2 border-b border-[var(--border)]">
        {(['about', 'timeline'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              'border-b-2 py-2.5 text-[13px] font-semibold capitalize',
              tab === t
                ? 'border-[var(--accent)] text-[var(--text-h)]'
                : 'border-transparent text-[var(--text-muted)] hover:bg-[var(--surface-hover)]',
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'about' ? (
        <div className="max-h-[440px] overflow-y-auto">
          <Section title="Basic Details">
            <Row label="Lead Name" value={lead.contact_name} />
            <Row label="Mobile Number" value={lead.contact_phone} />
            <Row label="Email Address" value={lead.contact_email} />
            <Row label="Creation Time" value={`${dayLabel(lead.created_at)} ${timeLabel(lead.created_at)}`} />
          </Section>
          <Section title="Lead Progress">
            <Row label="Status" value={lead.lead_status ? <Badge tone="accent">{lead.lead_status}</Badge> : 'Fresh Inquiry'} />
            <Row
              label="Follow-Up Date"
              value={
                lead.followup_date
                  ? `${formatIstDate(lead.followup_date)}${lead.followup_time ? ` ${formatIstTime(lead.followup_time)}` : ''}`
                  : null
              }
            />
            <Row label="Tag" value={lead.tag_name} />
            <Row label="Deal Amount" value={lead.deal_value} />
            <Row label="User Assigned" value={lead.assign_staff_name ?? (lead.assign_to_staff_id ? null : 'Unassigned')} />
            <Row label="Campaign" value={lead.lead_campaigns.map((c) => c.name).join(', ')} />
          </Section>
          <Section title="Latest Remark">
            <Row label="Remark" value={latestRemark?.remark ?? lead.discussion} />
            {latestRemark && <Row label="Date" value={`${dayLabel(latestRemark.created_at)} ${timeLabel(latestRemark.created_at)}`} />}
          </Section>
        </div>
      ) : loadingCalls || loadingActivity ? (
        <p className="p-4 text-[13px] text-[var(--text-muted)]">Loading history…</p>
      ) : (
        <div className="max-h-[440px] overflow-y-auto px-4 py-3">
          {groups.map((group) => (
            <div key={group.day} className="grid grid-cols-[92px_1fr] gap-3">
              <div className="pt-1">
                <span className="inline-block rounded-md bg-[var(--surface-hover)] px-2 py-1 text-[11px] font-medium text-[var(--text)]">
                  {group.day}
                </span>
              </div>
              <ol className="border-l border-[var(--border)] pl-4">
                {group.items.map((item) => (
                  <li key={item.id} className="relative pb-4">
                    <span
                      className={cn(
                        'absolute -left-[27px] top-0.5 flex h-[22px] w-[22px] items-center justify-center rounded-full text-white',
                        item.iconClass,
                      )}
                    >
                      {item.icon}
                    </span>
                    <p className="text-[13px] font-medium text-[var(--text-h)]">
                      {item.title} <span className="text-[var(--text-muted)]">| {timeLabel(item.at)}</span>
                    </p>
                    {item.chips && item.chips.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {item.chips.map((chip) => (
                          <Badge key={chip} tone="neutral">{chip}</Badge>
                        ))}
                      </div>
                    )}
                    {item.remark && (
                      <p className="mt-1.5 text-[12.5px] text-[var(--text)]">
                        <span className="font-semibold text-[var(--text-h)]">Remark: </span>
                        {item.remark}
                      </p>
                    )}
                    {item.note && <p className="mt-1 text-[12px] text-[var(--text-muted)]">{item.note}</p>}
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
