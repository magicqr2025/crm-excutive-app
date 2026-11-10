import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Bell, ChevronDown, ExternalLink, Handshake, ListChecks, Megaphone, MessagesSquare, StickyNote, Tag, type LucideIcon } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Textarea } from '@/components/ui/Input'
import { PageLoader } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/useToast'
import { useAddLeadNote, useContactActiveFollowups, useContactTasks, useDeals, useLeadForContact, useLeadNotes, useStaffList } from '@/api/queries'
import type { Conversation } from '@/api/inboxApi'
import { formatDate as fmtDate } from '@/lib/dateFormat'
import { STATUS_LABEL, STATUS_TONE, formatDate, formatTime } from '@/lib/followupFormat'
import { cn } from '@/lib/utils'
import { TASK_STATUS_LABEL, TASK_STATUS_TONE, isOpenTask } from '@/features/tasks/taskUi'

/** A collapsible card; the first ones start open, the rest are one tap away. */
function Section({ title, icon: Icon, count, defaultOpen = true, children }: { title: string; icon: LucideIcon; count?: number; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left hover:bg-[var(--surface-hover)]">
        <Icon size={14} className="shrink-0 text-[var(--accent-strong)]" />
        <span className="flex-1 text-[12px] font-semibold uppercase tracking-wide text-[var(--text-h)]">{title}</span>
        {count !== undefined && count > 0 && (
          <span className="rounded-full bg-[var(--surface-hover)] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[var(--text-muted)]">{count}</span>
        )}
        <ChevronDown size={14} className={cn('shrink-0 text-[var(--text-muted)] transition-transform', !open && '-rotate-90')} />
      </button>
      {open && <div className="border-t border-[var(--border)] px-3.5 py-3 text-[13px]">{children}</div>}
    </section>
  )
}

const Empty = ({ children }: { children: ReactNode }) => <p className="text-[12.5px] text-[var(--text-muted)]">{children}</p>

function Notes({ leadId }: { leadId: string }) {
  const { show } = useToast()
  const { data: notes = [], isLoading } = useLeadNotes(leadId)
  const addNote = useAddLeadNote(leadId)
  const [draft, setDraft] = useState('')

  function submit() {
    const content = draft.trim()
    if (!content || addNote.isPending) return
    addNote.mutate(content, {
      onSuccess: () => setDraft(''),
      onError: (err) => show({ title: err instanceof Error ? err.message : "Couldn't save the note", tone: 'error' }),
    })
  }

  return (
    <div className="space-y-2.5">
      <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add a note…" rows={2} className="min-h-[60px] rounded-lg py-2" />
      <Button size="sm" onClick={submit} disabled={!draft.trim() || addNote.isPending}>
        {addNote.isPending ? 'Saving…' : 'Add note'}
      </Button>
      {isLoading ? (
        <p className="text-[12.5px] text-[var(--text-muted)]">Loading…</p>
      ) : notes.length === 0 ? (
        <Empty>No notes yet.</Empty>
      ) : (
        <ul className="space-y-2">
          {notes.map((n) => (
            <li key={n.id} className="rounded-lg bg-[var(--surface-hover)] px-3 py-2">
              <p className="whitespace-pre-wrap break-words text-[13px] text-[var(--text-h)]">{n.content}</p>
              <p className="mt-1 text-[11px] text-[var(--text-muted)]">{fmtDate(n.created_at)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * Everything about the person behind a chat, one tap from the conversation: who the chat is assigned to,
 * their pipelines and labels, the next follow-up, tasks, deals and notes. The admin app shows this as a right-hand column.
 */
export function ConversationInfoSheet({ conversation, open, onClose }: { conversation: Conversation; open: boolean; onClose: () => void }) {
  const contactId = open ? conversation.contactId : null
  const { data: lead, isLoading: loadingLead } = useLeadForContact(contactId, conversation.contactPhone)
  const { data: followups = [] } = useContactActiveFollowups(contactId ?? '')
  const { data: tasks = [] } = useContactTasks(contactId)
  const { data: dealData } = useDeals(contactId ?? undefined)
  const { data: staff = [] } = useStaffList()

  const assignedName = conversation.assignedAgentId
    ? [staff.find((s) => s.user_id === conversation.assignedAgentId)?.first_name, staff.find((s) => s.user_id === conversation.assignedAgentId)?.last_name].filter(Boolean).join(' ')
    : ''
  const nextFollowup = [...followups].sort((a, b) => `${a.followup_date} ${a.followup_time}`.localeCompare(`${b.followup_date} ${b.followup_time}`))[0]
  const openTasks = tasks.filter(isOpenTask)
  const deals = dealData?.deals ?? []
  const tags = conversation.tags ?? []
  const resolved = conversation.status === 'resolved'

  return (
    <Dialog open={open} onClose={onClose}>
      <Dialog.Header>
        <Dialog.Title>Chat info</Dialog.Title>
        <Dialog.CloseButton onClose={onClose} />
      </Dialog.Header>
      <Dialog.Body className="space-y-3 bg-[var(--bg)]">
        <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5">
          <Avatar name={conversation.contactName} size={44} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14.5px] font-semibold text-[var(--text-h)]">{conversation.contactName}</p>
            <p className="truncate text-[12.5px] text-[var(--text-muted)]">{conversation.contactPhone}</p>
          </div>
        </div>

        {lead && (
          <Link
            to={`/contacts/${lead.id}`}
            className="flex items-center justify-between gap-2 rounded-xl border border-[var(--accent-border)] bg-[var(--accent-bg)] px-3.5 py-2.5 text-[13px] font-medium text-[var(--accent-strong)]"
          >
            Open {conversation.contactName}'s profile <ExternalLink size={14} className="shrink-0" />
          </Link>
        )}

        <Section title="Conversation" icon={MessagesSquare}>
          <dl className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[var(--text-muted)]">Assigned staff</dt>
              <dd className="font-medium text-[var(--text-h)]">{assignedName || '—'}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[var(--text-muted)]">Status</dt>
              <dd>
                <Badge tone={resolved ? 'neutral' : 'success'}>{resolved ? 'Resolved' : 'Open'}</Badge>
              </dd>
            </div>
            {lead?.lead_status && (
              <div className="flex items-center justify-between gap-3">
                <dt className="text-[var(--text-muted)]">Lead status</dt>
                <dd>
                  <Badge tone="accent">{lead.lead_status}</Badge>
                </dd>
              </div>
            )}
          </dl>
        </Section>

        <Section title="Pipelines" icon={Megaphone}>
          {loadingLead ? (
            <Empty>Loading…</Empty>
          ) : !lead || lead.lead_campaigns.length === 0 ? (
            <Empty>Not in any pipeline.</Empty>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {lead.lead_campaigns.map((c) => (
                <Badge key={c.id} tone="info">
                  {c.name}
                </Badge>
              ))}
            </div>
          )}
        </Section>

        <Section title="Labels" icon={Tag}>
          {tags.length === 0 ? (
            <Empty>No labels.</Empty>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <Badge key={t}>{t}</Badge>
              ))}
            </div>
          )}
        </Section>

        <Section title="Follow-up" icon={Bell}>
          {!nextFollowup ? (
            <Empty>Nothing scheduled.</Empty>
          ) : (
            <Link to={`/followups/${nextFollowup.id}`} className="flex items-center justify-between gap-2 hover:underline">
              <span className="text-[var(--text-h)]">
                {formatDate(nextFollowup.followup_date)} · {formatTime(nextFollowup.followup_time)}
              </span>
              <Badge tone={STATUS_TONE[nextFollowup.followup_status]}>{STATUS_LABEL[nextFollowup.followup_status]}</Badge>
            </Link>
          )}
        </Section>

        <Section title="Tasks" icon={ListChecks} count={openTasks.length} defaultOpen={false}>
          {tasks.length === 0 ? (
            <Empty>No tasks linked to this contact yet.</Empty>
          ) : (
            <ul className="space-y-2">
              {tasks.map((t) => (
                <li key={t.id} className="flex items-start justify-between gap-2">
                  <span className="min-w-0 flex-1 truncate text-[var(--text-h)]">{t.title}</span>
                  <Badge tone={TASK_STATUS_TONE[t.status]}>{TASK_STATUS_LABEL[t.status]}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Deals" icon={Handshake} count={deals.length} defaultOpen={false}>
          {deals.length === 0 ? (
            <Empty>No deals yet.</Empty>
          ) : (
            <ul className="space-y-2">
              {deals.map((d) => (
                <li key={d.id} className="flex items-start justify-between gap-2">
                  <span className="min-w-0 flex-1 truncate text-[var(--text-h)]">{d.deal_name}</span>
                  <span className="shrink-0 font-medium tabular-nums text-[var(--text-h)]">₹{Math.round(d.deal_amount).toLocaleString('en-IN')}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Notes" icon={StickyNote} defaultOpen={false}>
          {lead ? <Notes leadId={lead.id} /> : loadingLead ? <PageLoader /> : <Empty>Notes are kept on the lead, and this contact has none you can see.</Empty>}
        </Section>
      </Dialog.Body>
    </Dialog>
  )
}
