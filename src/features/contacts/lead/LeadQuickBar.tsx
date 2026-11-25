import { BellRing, CalendarClock, Handshake, IndianRupee, PhoneCall, Plus, StickyNote, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { KIND_COLOR, type LeadFormKind, type LeadTab } from './leadConstants'
import { formatRupees, type LeadTotals } from './leadMath'


const QUICK: { kind: LeadFormKind | 'note'; label: string; icon: LucideIcon }[] = [
  { kind: 'followup', label: 'Follow-up', icon: BellRing },
  { kind: 'meeting', label: 'Meeting', icon: CalendarClock },
  { kind: 'deal', label: 'Deal', icon: Handshake },
  { kind: 'payment', label: 'Payment', icon: IndianRupee },
  { kind: 'note', label: 'Note', icon: StickyNote },
]

function Dot({ color, icon: Icon, size = 26 }: { color: string; icon: LucideIcon; size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full"
      style={{ width: size, height: size, background: `color-mix(in srgb, ${color} 15%, transparent)`, color }}
    >
      <Icon size={size * 0.52} />
    </span>
  )
}

/** "+ Add" chips: one tap opens that form for this client. Swipes sideways on a narrow phone. */
export function QuickAddRow({ onAdd, onNote }: { onAdd: (kind: LeadFormKind) => void; onNote: () => void }) {
  return (
    <div className="scroll-x-quiet -mx-3 px-3 sm:mx-0 sm:px-0">
      <div className="flex w-max items-center gap-2 sm:w-auto sm:flex-wrap">
        <span className="mr-0.5 flex items-center gap-1 font-mono-num text-[11px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
          <Plus size={12} /> Add
        </span>
        {QUICK.map(({ kind, label, icon }) => (
          <button
            key={kind}
            type="button"
            onClick={() => (kind === 'note' ? onNote() : onAdd(kind))}
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] py-1 pl-1.5 pr-4 text-[13.5px] font-medium text-[var(--text-h)] shadow-[var(--shadow-sm)] transition-colors hover:border-[var(--accent-border)] hover:bg-[var(--surface-hover)]"
          >
            <Dot color={KIND_COLOR[kind]} icon={icon} />
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

interface Tile {
  tab: LeadTab
  color: string
  icon: LucideIcon
  value: string
  label: string
  sub: string
}

/** Five counts; tapping one opens its tab. 3 + 2 on a phone, one row from a tablet up. */
export function StatTiles({ totals, onOpen }: { totals: LeadTotals; onOpen: (tab: LeadTab) => void }) {
  const tiles: Tile[] = [
    { tab: 'calls', color: KIND_COLOR.call, icon: PhoneCall, value: String(totals.calls), label: totals.calls === 1 ? 'Call' : 'Calls', sub: `${totals.connected} connected` },
    { tab: 'followup', color: KIND_COLOR.followup, icon: BellRing, value: String(totals.openFollowups), label: 'Follow-ups', sub: 'open' },
    { tab: 'meeting', color: KIND_COLOR.meeting, icon: CalendarClock, value: String(totals.meetings), label: totals.meetings === 1 ? 'Meeting' : 'Meetings', sub: `${totals.scheduledMeetings} scheduled` },
    { tab: 'deal', color: KIND_COLOR.deal, icon: Handshake, value: String(totals.deals), label: totals.deals === 1 ? 'Deal' : 'Deals', sub: formatRupees(totals.dealValue) },
    { tab: 'payment', color: KIND_COLOR.payment, icon: IndianRupee, value: formatRupees(totals.received), label: 'Received', sub: totals.balance > 0 ? `${formatRupees(totals.balance)} due` : `${totals.payments} payment${totals.payments === 1 ? '' : 's'}` },
  ]
  return (
    <div className="grid grid-cols-3 gap-2 md:grid-cols-5 md:gap-3">
      {tiles.map((t, i) => (
        <button
          key={t.tab}
          type="button"
          onClick={() => onOpen(t.tab)}
          className={cn(
            'flex min-w-0 flex-col items-start gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-left shadow-[var(--shadow-sm)] transition-colors hover:border-[var(--accent-border)] md:flex-row md:items-center md:gap-3',
            // The last two share the second row on a phone: let them stretch to fill it.
            i === 3 && 'max-md:col-span-1',
            i === 4 && 'max-md:col-span-2',
          )}
        >
          <Dot color={t.color} icon={t.icon} size={32} />
          <span className="min-w-0">
            <span className="block truncate font-mono-num text-[17px] font-semibold leading-tight text-[var(--text-h)]">{t.value}</span>
            <span className="block truncate text-[12px] font-medium text-[var(--text)]">{t.label}</span>
            <span className="block truncate text-[11px] text-[var(--text-muted)]">{t.sub}</span>
          </span>
        </button>
      ))}
    </div>
  )
}
