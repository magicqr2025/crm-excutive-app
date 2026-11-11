import { type ReactNode, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Lock, RotateCcw, Send, XCircle } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Input'
import { PageLoader } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/useToast'
import { useAddTicketComment, useSetTicketStatus, useStaffList, useTicket, useTriageTicket } from '@/api/queries'
import type { TicketComment, TicketDetail, TicketPriority, TicketStatus } from '@/api/ticketsApi'
import { useAuthStore } from '@/store/useAuthStore'
import { AttachmentLink, AttachmentPicker, CloudImages } from './TicketAttachments'
import {
  SELECT_CLASS,
  TICKET_PRIORITY_LABEL,
  TICKET_PRIORITY_OPTIONS,
  TICKET_PRIORITY_TONE,
  TICKET_STATUSES,
  TICKET_STATUS_LABEL,
  TICKET_STATUS_TONE,
  TICKET_TYPE_LABEL,
  TICKET_TYPE_TONE,
  formatDateTime,
  getTicketPermissions,
  isActiveTicket,
  ticketNumber,
  timeAgo,
} from './ticketUi'

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)]">
      <h2 className="mb-3 text-[14px] font-semibold text-[var(--text-h)]">{title}</h2>
      {children}
    </section>
  )
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-3">
      <dt className="text-[12px] font-medium leading-5 text-[var(--text-muted)]">{label}</dt>
      <dd className="break-words text-[13px] text-[var(--text-h)]">{value}</dd>
    </div>
  )
}

function CommentRow({ comment, isOwn }: { comment: TicketComment; isOwn: boolean }) {
  if (comment.is_system) {
    return (
      <p className="text-center text-[12px] text-[var(--text-muted)]">
        {comment.body} · {comment.author_name ?? 'System'} · {timeAgo(comment.created_at)}
      </p>
    )
  }
  return (
    <div
      className={`rounded-lg border p-3 ${
        comment.is_internal ? 'border-[var(--warning-border)] bg-[var(--warning-bg)]' : isOwn ? 'border-[var(--accent-border)] bg-[var(--accent-bg)]' : 'border-[var(--border)]'
      }`}
    >
      <div className="mb-1 flex flex-wrap items-center gap-2 text-[12px] text-[var(--text-muted)]">
        <span className="font-medium text-[var(--text-h)]">{comment.author_name ?? 'Unknown'}</span>
        <span title={formatDateTime(comment.created_at)}>{timeAgo(comment.created_at)}</span>
        {comment.is_internal && (
          <Badge tone="warning">
            <Lock size={10} /> Internal note
          </Badge>
        )}
      </div>
      {comment.body && <p className="whitespace-pre-wrap break-words text-[13.5px] text-[var(--text-h)]">{comment.body}</p>}
      <CloudImages files={comment.cloud_files} />
      {comment.attachments.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {comment.attachments.map((a) => (
            <AttachmentLink key={a.id} attachment={a} />
          ))}
        </div>
      )}
    </div>
  )
}

function ReplyBox({ ticketId, canInternal }: { ticketId: string; canInternal: boolean }) {
  const { show } = useToast()
  const addComment = useAddTicketComment()
  const [body, setBody] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [internal, setInternal] = useState(false)
  const canSend = (body.trim() !== '' || files.length > 0) && !addComment.isPending

  function send() {
    addComment.mutate(
      { id: ticketId, body: body.trim(), isInternal: internal, files },
      {
        onSuccess: () => {
          setBody('')
          setFiles([])
          setInternal(false)
        },
        onError: (err) => show({ title: err instanceof Error ? err.message : 'Could not send the reply', tone: 'error' }),
      },
    )
  }

  return (
    <div className="space-y-2">
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} maxLength={10000} placeholder={internal ? 'Write a note only staff can see…' : 'Write a reply…'} aria-label="Reply" />
      <AttachmentPicker files={files} onChange={setFiles} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        {canInternal ? (
          <label className="flex items-center gap-1.5 text-[12.5px] text-[var(--text-muted)]">
            <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} />
            Internal note (hidden from the person who raised it)
          </label>
        ) : (
          <span />
        )}
        <Button size="sm" disabled={!canSend} onClick={send}>
          <Send size={13} /> {addComment.isPending ? 'Sending…' : internal ? 'Add note' : 'Reply'}
        </Button>
      </div>
    </div>
  )
}

export function TicketDetailPage() {
  const { ticketId } = useParams()
  const navigate = useNavigate()
  const { data: ticket, isLoading, error } = useTicket(ticketId)

  if (isLoading) return <PageLoader />
  if (!ticket) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <XCircle size={24} className="text-[var(--text-muted)]" />
        <p className="text-[14px] font-medium text-[var(--text-h)]">Could not open this ticket</p>
        <p className="text-[13px] text-[var(--text-muted)]">{error instanceof Error ? error.message : 'It may not exist, or you may not have access to it.'}</p>
        <Button size="sm" variant="secondary" onClick={() => navigate('/tickets')}>
          <ArrowLeft size={14} /> Back to tickets
        </Button>
      </div>
    )
  }
  return <Loaded key={ticket.id} ticket={ticket} />
}

function Loaded({ ticket }: { ticket: TicketDetail }) {
  const navigate = useNavigate()
  const { show } = useToast()
  const userId = useAuthStore((s) => s.user?.id ?? '')
  const isAdmin = useAuthStore((s) => s.isAdmin)
  const { data: staff = [] } = useStaffList()
  const setStatus = useSetTicketStatus()
  const triage = useTriageTicket()
  const can = getTicketPermissions(ticket, userId, isAdmin)
  const busy = setStatus.isPending

  const fail = (fallback: string) => (err: unknown) => show({ title: err instanceof Error ? err.message : fallback, tone: 'error' })

  function moveTo(status: TicketStatus, done?: string) {
    setStatus.mutate({ id: ticket.id, status }, { onSuccess: () => done && show({ title: done, tone: 'success' }), onError: fail('Could not update the status') })
  }

  function triageChange(patch: { priority?: TicketPriority; assignToStaffId?: string | null }) {
    triage.mutate({ id: ticket.id, patch }, { onSuccess: () => show({ title: 'Ticket updated', tone: 'success' }), onError: fail('Could not update the ticket') })
  }

  const fromPublicPage = ticket.requester_type === 'public_page'
  const raiserName = fromPublicPage ? (ticket.customer_name ?? 'Customer') : (ticket.raised_by_name ?? (ticket.raised_via_api ? 'API integration' : null))
  const customer = [ticket.contact_name ?? ticket.customer_name, ticket.customer_phone, ticket.customer_email].filter(Boolean).join(' · ')
  const leadEvent = ticket.comments[0]?.is_system ? ticket.comments[0] : null
  const staffName = (s: { first_name: string | null; last_name: string | null; user_id: string }) => `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim() || s.user_id

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[var(--surface)]">
      <PageHeader
        title={ticketNumber(ticket.number)}
        subtitle={ticket.subject}
        action={
          <Button size="sm" variant="secondary" onClick={() => navigate('/tickets')}>
            <ArrowLeft size={14} /> Back
          </Button>
        }
      />

      <div className="mx-auto w-full max-w-3xl space-y-4 p-4">
        <Panel title={ticket.subject}>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={TICKET_STATUS_TONE[ticket.status]}>{TICKET_STATUS_LABEL[ticket.status]}</Badge>
            <Badge tone={TICKET_PRIORITY_TONE[ticket.priority]}>{TICKET_PRIORITY_LABEL[ticket.priority]} priority</Badge>
            <Badge tone={TICKET_TYPE_TONE[ticket.ticket_type]}>{TICKET_TYPE_LABEL[ticket.ticket_type]}</Badge>
          </div>
          <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--surface-hover)] px-3.5 py-3">
            <p className="whitespace-pre-wrap break-words text-[13.5px] leading-relaxed text-[var(--text-h)]">{ticket.description}</p>
          </div>
          {ticket.attachments.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2 border-t border-[var(--border)] pt-3">
              {ticket.attachments.map((a) => (
                <AttachmentLink key={a.id} attachment={a} />
              ))}
            </div>
          )}
          <CloudImages files={ticket.cloud_files} />
          <dl className="mt-4 space-y-2 border-t border-[var(--border)] pt-3">
            {raiserName && <Fact label="Raised by" value={raiserName} />}
            <Fact label="Category" value={ticket.category_name ?? '—'} />
            <Fact label="Page URL" value={ticket.product_name ?? '—'} />
            {!fromPublicPage && <Fact label="Customer" value={customer || '—'} />}
            {fromPublicPage && customer && <Fact label="Customer" value={customer} />}
            <Fact label="Assigned to" value={ticket.assigned_to_name ?? 'Not assigned yet'} />
            <Fact label="Created" value={formatDateTime(ticket.created_at)} />
            <Fact label="Last update" value={formatDateTime(ticket.updated_at)} />
            {ticket.resolved_at && <Fact label="Resolved" value={formatDateTime(ticket.resolved_at)} />}
            {ticket.closed_at && <Fact label="Closed" value={formatDateTime(ticket.closed_at)} />}
          </dl>
        </Panel>

        {(can.manage || can.close || can.reopen || can.triage) && (
          <Panel title="Manage">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {can.manage && isActiveTicket(ticket) && ticket.status !== 'resolved' && (
                  <Button size="sm" variant="secondary" disabled={busy} onClick={() => moveTo('resolved', 'Marked as resolved')}>
                    <CheckCircle2 size={14} /> Mark resolved
                  </Button>
                )}
                {(can.manage || can.close) && ticket.status !== 'closed' && (
                  <Button size="sm" variant="danger" disabled={busy} onClick={() => moveTo('closed', 'Ticket closed')}>
                    <XCircle size={14} /> Close ticket
                  </Button>
                )}
                {(can.manage || can.reopen) && (ticket.status === 'closed' || ticket.status === 'resolved') && (
                  <Button size="sm" disabled={busy} onClick={() => moveTo('open', 'Ticket reopened')}>
                    <RotateCcw size={14} /> Reopen
                  </Button>
                )}
              </div>
              {can.manage && (
                <label className="block">
                  <span className="mb-1 block text-[12px] font-medium text-[var(--text-muted)]">Status</span>
                  <select value={ticket.status} disabled={busy} onChange={(e) => moveTo(e.target.value as TicketStatus)} className={SELECT_CLASS}>
                    {TICKET_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {TICKET_STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {can.triage && (
                <>
                  <label className="block">
                    <span className="mb-1 block text-[12px] font-medium text-[var(--text-muted)]">Priority</span>
                    <select value={ticket.priority} disabled={triage.isPending} onChange={(e) => triageChange({ priority: e.target.value as TicketPriority })} className={SELECT_CLASS}>
                      {TICKET_PRIORITY_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[12px] font-medium text-[var(--text-muted)]">Assigned to</span>
                    <select
                      value={ticket.assign_to_staff_id ?? ''}
                      disabled={triage.isPending}
                      onChange={(e) => triageChange({ assignToStaffId: e.target.value === '' ? null : e.target.value })}
                      className={SELECT_CLASS}
                    >
                      <option value="">Unassigned</option>
                      {staff.map((s) => (
                        <option key={s.user_id} value={s.user_id}>
                          {staffName(s)}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              )}
            </div>
          </Panel>
        )}
        {!can.manage && !can.close && !can.reopen && <p className="px-1 text-[12px] text-[var(--text-muted)]">Only the assignee or an admin can change this ticket&apos;s status.</p>}

        <Panel title="Conversation">
          {leadEvent && <CommentRow comment={leadEvent} isOwn={false} />}
          <div className="mt-2 space-y-2.5">
            {ticket.comments.length === 0 && <p className="text-[12.5px] text-[var(--text-muted)]">No replies yet.</p>}
            {(leadEvent ? ticket.comments.slice(1) : ticket.comments).map((c) => (
              <CommentRow key={c.id} comment={c} isOwn={c.author_id === userId} />
            ))}
          </div>
          <div className="mt-4 border-t border-[var(--border)] pt-4">
            {ticket.status === 'closed' ? (
              <p className="rounded-lg bg-[var(--surface-hover)] px-3 py-2 text-[12.5px] text-[var(--text-muted)]">
                This ticket is closed.{can.reopen || can.manage ? ' Reopen it to reply.' : ''}
              </p>
            ) : (
              <ReplyBox ticketId={ticket.id} canInternal={can.internalNote} />
            )}
          </div>
        </Panel>
      </div>
    </div>
  )
}
