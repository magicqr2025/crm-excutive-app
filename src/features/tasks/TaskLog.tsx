import { useState } from 'react'
import { Archive, ArrowRightLeft, CheckSquare, ChevronDown, ChevronUp, Flag, History, ImagePlus, MessageSquare, NotebookPen, Pencil, Plus, UserRound, type LucideIcon } from 'lucide-react'
import { useTaskLogs } from '@/api/queries'
import type { CrmTask, TaskLogEntry } from '@/api/crmApi'
import { formatDate } from '@/lib/dateFormat'

type Tone = 'accent' | 'info' | 'success'

// What happened decides the icon and its colour, so the timeline can be scanned without reading it:
// conversation is blue, completions and new things are green, everything else is the app's amber.
const KIND: Record<string, { icon: LucideIcon; tone: Tone }> = {
  created: { icon: Plus, tone: 'success' },
  status: { icon: ArrowRightLeft, tone: 'accent' },
  assignee: { icon: UserRound, tone: 'accent' },
  edited: { icon: Pencil, tone: 'accent' },
  comment: { icon: MessageSquare, tone: 'info' },
  work_notes: { icon: NotebookPen, tone: 'info' },
  work_images: { icon: ImagePlus, tone: 'info' },
  subtask: { icon: CheckSquare, tone: 'success' },
  closed: { icon: Archive, tone: 'success' },
}

const TONE_STYLE: Record<Tone, { bg: string; fg: string }> = {
  accent: { bg: 'var(--accent-bg)', fg: 'var(--accent-strong)' },
  info: { bg: 'var(--info-bg)', fg: 'var(--info)' },
  success: { bg: 'var(--success-bg)', fg: 'var(--success)' },
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

// The task's history as a timeline, newest first: a day label, then a soft icon on the line for every change,
// with what happened on top and who did it, and when, underneath.
export function TaskLog({ task }: { task: CrmTask }) {
  const { data: entries = [], isLoading, isError } = useTaskLogs(task.id)
  const [expanded, setExpanded] = useState(false)
  // The newest few are enough at a glance; the rest are one tap away.
  const hidden = Math.max(0, entries.length - PREVIEW_COUNT)
  const groups = groupByDay(expanded ? entries : entries.slice(0, PREVIEW_COUNT))

  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-sm)]">
      <header className="flex items-center justify-between gap-2 px-4 pb-1 pt-4 sm:px-5">
        <h3 className="flex items-center gap-2 text-[14px] font-semibold text-[var(--text-h)]">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--accent-bg)] text-[var(--accent-strong)]">
            <History size={15} />
          </span>
          Task log
        </h3>
        {entries.length > 0 && <span className="rounded-full bg-[var(--surface-hover)] px-2 py-0.5 text-[11.5px] font-semibold tabular-nums text-[var(--text-muted)]">{entries.length}</span>}
      </header>

      <div className="px-4 pb-4 pt-3 sm:px-5">
        {isLoading ? (
          <p className="text-[13px] text-[var(--text-muted)]">Loading…</p>
        ) : isError ? (
          <p className="text-[13px] text-[var(--error)]">Could not load the task log.</p>
        ) : entries.length === 0 ? (
          <p className="rounded-xl bg-[var(--surface-hover)] px-3.5 py-3 text-[13px] text-[var(--text-muted)]">Nothing logged yet. Changes from now on will appear here.</p>
        ) : (
          <div className="scrollbar-thin max-h-[420px] space-y-5 overflow-y-auto pr-1">
            {groups.map((g) => (
              <section key={g.day}>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{g.day}</span>
                  <span aria-hidden className="h-px flex-1 bg-[var(--border)]" />
                </div>
                <ol className="mt-3">
                  {g.items.map((e, i) => {
                    const { icon: Icon, tone } = KIND[e.kind] ?? { icon: Flag, tone: 'accent' as Tone }
                    const colors = TONE_STYLE[tone]
                    return (
                      <li key={e.id} className="relative flex gap-3 pb-4 last:pb-0">
                        {i < g.items.length - 1 && <span aria-hidden className="absolute bottom-0 left-[13.5px] top-8 w-px bg-[var(--border)]" />}
                        <span className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full" style={{ background: colors.bg, color: colors.fg }}>
                          <Icon size={13} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="break-words text-[13.5px] font-medium leading-snug text-[var(--text-h)]">{e.summary}</p>
                          <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">
                            {e.actor_name} <span aria-hidden>·</span> <span className="tabular-nums">{timeOf(e.created_at)}</span>
                          </p>
                        </div>
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
            className="mx-auto mt-3 flex items-center gap-1.5 rounded-full bg-[var(--surface-hover)] px-4 py-1.5 text-[12.5px] font-semibold text-[var(--accent-strong)] transition hover:brightness-95"
          >
            {expanded ? (
              <>
                See less <ChevronUp size={14} />
              </>
            ) : (
              <>
                See {hidden} more <ChevronDown size={14} />
              </>
            )}
          </button>
        )}
      </div>
    </section>
  )
}
