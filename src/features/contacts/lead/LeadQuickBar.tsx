import { BellRing, CalendarClock, Handshake, Layers, IndianRupee, Link2, ListChecks, Megaphone, Package, Pencil, StickyNote, Tag, Users, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { KIND_COLOR, type LeadFormKind } from './leadConstants'
import type { LeadField } from '@/features/followups/LeadUpdatePanel'

// Same chips, order and names as orm-whatsapp's Quick add.
const QUICK: { kind: LeadFormKind | 'note'; label: string; icon: LucideIcon }[] = [
  { kind: 'task', label: 'Task', icon: ListChecks },
  { kind: 'followup', label: 'Follow-up', icon: BellRing },
  { kind: 'meeting', label: 'Meeting', icon: CalendarClock },
  { kind: 'deal', label: 'Deal', icon: Handshake },
  { kind: 'payment', label: 'Payment', icon: IndianRupee },
  { kind: 'paylink', label: 'Payment link', icon: Link2 },
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

/** "+ Add" chips: one tap opens that form for this client. Always one row; it swipes sideways when it doesn’t fit. A chip is left out when the role can't use it. */
export function QuickAddRow({ onAdd, onNote, hidden = [] }: { onAdd: (kind: LeadFormKind) => void; onNote: () => void; hidden?: LeadFormKind[] }) {
  return (
    <div className="scroll-x-quiet -mx-3 px-3 sm:-mx-5 sm:px-5 lg:mx-0 lg:px-0">
      <div className="flex w-max items-center gap-2">
        {QUICK.filter((q) => q.kind === 'note' || !hidden.includes(q.kind)).map(({ kind, label, icon }) => (
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

interface InfoTile {
  key: LeadField
  icon: LucideIcon
  color: string
  label: string
  names: string[]
  /** This person may change it, so the tile has its own Edit button. */
  editable: boolean
  /** A colour dot inside the chip (the status's own colour). */
  dot?: string
  /** Takes the whole row on a phone. */
  wide?: boolean
}

// Names are what people read here, so they are the tile's body (readable chips), not a small grey line.
const MAX_CHIPS = 3

/**
 * Where the lead sits: stage & status, pipelines, labels, groups and products (stage & status across the top on a
 * phone, then 2 × 2; one row of five from a tablet up).
 * Each tile shows its names as chips; one the person may change has its own pencil button, which edits just that part.
 */
export function LeadInfoTiles({
  stage,
  status,
  statusColor,
  pipelines,
  labels,
  groups,
  products,
  onEdit,
  canEditPipelines,
  canEditProducts,
}: {
  stage: string | null
  status: string | null
  statusColor: string | null
  pipelines: string[]
  labels: string[]
  groups: string[]
  products: string[]
  onEdit?: (field: LeadField) => void
  canEditPipelines: boolean
  canEditProducts: boolean
}) {
  const stageStatus = [stage, status].filter(Boolean).join(' · ')
  const tiles: InfoTile[] = [
    { key: 'status', icon: Layers, color: '#2563eb', label: 'Stage & Status', names: stageStatus ? [stageStatus] : [], editable: true, dot: statusColor || undefined, wide: true },
    { key: 'pipelines', icon: Megaphone, color: '#c97a1a', label: pipelines.length === 1 ? 'Pipeline' : 'Pipelines', names: pipelines, editable: canEditPipelines },
    { key: 'labels', icon: Tag, color: '#db2777', label: labels.length === 1 ? 'Label' : 'Labels', names: labels, editable: true },
    { key: 'groups', icon: Users, color: '#4f46e5', label: groups.length === 1 ? 'Group' : 'Groups', names: groups, editable: true },
    { key: 'products', icon: Package, color: '#0d9488', label: products.length === 1 ? 'Product' : 'Products', names: products, editable: canEditProducts },
  ]
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-5 md:gap-3">
      {tiles.map((t) => {
        const canEdit = t.editable && Boolean(onEdit)
        const shown = t.names.slice(0, MAX_CHIPS)
        const more = t.names.length - shown.length
        return (
          <div key={t.key} className={cn('flex min-w-0 flex-col gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[var(--shadow-sm)]', t.wide && 'max-md:col-span-2')}>
            <div className="flex items-center gap-2">
              <Dot color={t.color} icon={t.icon} size={28} />
              <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[var(--text-h)]">{t.label}</span>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => onEdit?.(t.key)}
                  aria-label={`Edit ${t.label.toLowerCase()}`}
                  title="Edit"
                  className="-my-1 -mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-muted)] transition-colors hover:border-[var(--accent-border)] hover:text-[var(--accent-strong)]"
                >
                  <Pencil size={13} />
                </button>
              )}
            </div>
            {t.names.length === 0 ? (
              <p className="text-[13px] text-[var(--text-muted)]">None</p>
            ) : (
              <div className="flex flex-wrap gap-1.5" title={t.names.join(', ')}>
                {shown.map((name, i) => (
                  <span
                    key={`${name}-${i}`}
                    className="inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-medium leading-tight"
                    style={{ background: `color-mix(in srgb, ${t.color} 12%, transparent)`, color: `color-mix(in srgb, ${t.color} 75%, var(--text-h))` }}
                  >
                    {t.dot && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: t.dot }} />}
                    <span className="truncate">{name}</span>
                  </span>
                ))}
                {more > 0 && <span className="rounded-full bg-[var(--surface-hover)] px-2.5 py-1 text-[13px] font-medium leading-tight text-[var(--text-muted)]">+{more}</span>}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
