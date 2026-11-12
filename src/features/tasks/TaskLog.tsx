import { useState } from 'react'
import { Archive, ArrowRightLeft, CheckSquare, ChevronDown, ChevronUp, Flag, History, ImagePlus, MessageSquare, NotebookPen, Pencil, Plus, UserRound, type LucideIcon } from 'lucide-react'
import { useTaskLogs } from '@/api/queries'
import type { CrmTask, TaskLogEntry } from '@/api/crmApi'
import { formatDate } from '@/lib/dateFormat'

const KIND_ICON: Record<string, LucideIcon> = {
  created: Plus,
  status: ArrowRightLeft,
  assignee: UserRound,
  edited: Pencil,
  comment: MessageSquare,
  work_notes: NotebookPen,
  work_images: ImagePlus,
  subtask: CheckSquare,
  closed: Archive,
}

const PREVIEW_COUNT = 3

function timeOf(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase()
}

// Entries are newest first; keep that order and start a new day group whenever the date changes.
function groupByDay(entries: TaskLogEntry[]): { day: string; items: TaskLogEntry[] }[] {
  const groups: { day: string; items: TaskLogEntry[] }[] = []
  for (const e of entries) {
    const day = formatDate(e.created_at)
    const last = groups[groups.length - 1]
    if (last && last.day === day) last.items.push(e)
    else groups.push({ day, items: [e] })
  }
  return groups
}

// The task's history as a timeline, newest first: a date chip per day, then a dot on the line for every change.
export function TaskLog({ task }: { task: CrmTask }) {
  const { data: entries = [], isLoading, isError } = useTaskLogs(task.id)
  const [expanded, setExpanded] = useState(false)
  // The newest few are enough at a glance; the rest are one tap away.
  const hidden = Math.max(0, entries.length - PREVIEW_COUNT)
  const groups = groupByDay(expanded ? entries : entries.slice(0, PREVIEW_COUNT))

  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-sm)]">
      <header className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
        <h3 className="flex items-center gap-1.5 text-[14px] font-semibold text-[var(--text-h)]">
          <History size={15} className="text-[var(--accent-strong)]" /> Task log
        </h3>
        {entries.length > 0 && <span className="text-[12px] text-[var(--text-muted)]">{entries.length}</span>}
      </header>
      <div className="p-4">
        {isLoading ? (
          <p className="text-[13px] text-[var(--text-muted)]">Loading…</p>
        ) : isError ? (
          <p className="text-[13px] text-[var(--error)]">Could not load the task log.</p>
        ) : entries.length === 0 ? (
          <p className="text-[13px] text-[var(--text-muted)]">Nothing logged yet. Changes from now on will appear here.</p>
        ) : (
          <div className="scrollbar-thin max-h-[420px] space-y-4 overflow-y-auto pr-1">
            {groups.map((g) => (
              <section key={g.day}>
                <span className="inline-block rounded-lg bg-[var(--surface-hover)] px-3 py-1 text-[12px] font-medium text-[var(--text-muted)]">{g.day}</span>
                <ol className="mt-3">
                  {g.items.map((e, i) => {
                    const Icon = KIND_ICON[e.kind] ?? Flag
                    return (
                      <li key={e.id} className="relative flex gap-3 pb-5 last:pb-0">
                        {i < g.items.length - 1 && <span aria-hidden className="absolute bottom-0 left-[13.5px] top-[14px] w-px bg-[var(--border)]" />}
                        <span className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--ink)] ring-4 ring-[var(--surface)]">
                          <Icon size={13} />
                        </span>
                        <p className="min-w-0 flex-1 break-words pt-0.5 text-[13.5px] font-medium leading-snug text-[var(--text-h)]">
                          {e.summary}
                          <span className="font-normal text-[var(--text-muted)]">
                            {' '}
                            · by {e.actor_name} | {timeOf(e.created_at)}
                          </span>
                        </p>
                      </li>
                    )
                  })}
                </ol>
              </section>
            ))}
          </div>
        )}
        {hidden > 0 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] py-2 text-[13px] font-medium text-[var(--accent-strong)] hover:bg-[var(--surface-hover)]"
          >
            {expanded ? (
              <>
                See less <ChevronUp size={14} />
              </>
            ) : (
              <>
                See more ({hidden} more) <ChevronDown size={14} />
              </>
            )}
          </button>
        )}
      </div>
    </section>
  )
}
