import { useState } from 'react'
import { ArrowLeft, History } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Textarea } from '@/components/ui/Input'
import { useToast } from '@/components/ui/useToast'
import {
  useEmailBatch,
  useEmailBatches,
  useEmailTemplates,
  useRetryFailedEmails,
  useSendBulkEmail,
  useZeptomailStatus,
} from '@/api/queries'
import type { CrmLead, EmailBatch } from '@/api/crmApi'

const SELECT_CLASS =
  'h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text-h)] outline-none focus:border-[var(--accent-border)]'

const MAX_RECIPIENTS = 500

type View = { kind: 'compose' } | { kind: 'history' } | { kind: 'batch'; id: string }

interface BulkEmailDialogProps {
  open: boolean
  onClose: () => void
  selectedLeads: CrmLead[]
  /** Called once a batch is queued, so the page can clear its selection. */
  onQueued: () => void
}

export function BulkEmailDialog({ open, onClose, selectedLeads, onQueued }: BulkEmailDialogProps) {
  // Mounted only while open (see below), so each opening starts on the compose form with a fresh key.
  return (
    <Dialog open={open} onClose={onClose} className="max-w-xl">
      {open && <BulkEmailBody onClose={onClose} selectedLeads={selectedLeads} onQueued={onQueued} />}
    </Dialog>
  )
}

function BulkEmailBody({ onClose, selectedLeads, onQueued }: Omit<BulkEmailDialogProps, 'open'>) {
  const [view, setView] = useState<View>({ kind: 'compose' })
  const title = view.kind === 'compose' ? 'Send bulk email' : view.kind === 'history' ? 'Bulk email history' : 'Bulk email progress'
  return (
    <>
      <Dialog.Header>
        <div className="flex items-center gap-2">
          {view.kind !== 'compose' && (
            <button
              type="button"
              aria-label="Back"
              onClick={() => setView(view.kind === 'batch' ? { kind: 'history' } : { kind: 'compose' })}
              className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"
            >
              <ArrowLeft size={16} />
            </button>
          )}
          <Dialog.Title>{title}</Dialog.Title>
        </div>
        <div className="flex items-center gap-1">
          {view.kind === 'compose' && (
            <Button variant="ghost" size="sm" onClick={() => setView({ kind: 'history' })}>
              <History size={14} /> History
            </Button>
          )}
          <Dialog.CloseButton onClose={onClose} />
        </div>
      </Dialog.Header>
      {view.kind === 'compose' && (
        <ComposeForm
          selectedLeads={selectedLeads}
          onClose={onClose}
          onQueued={(id) => {
            onQueued()
            setView({ kind: 'batch', id })
          }}
        />
      )}
      {view.kind === 'history' && <HistoryList onOpen={(id) => setView({ kind: 'batch', id })} />}
      {view.kind === 'batch' && <BatchProgress id={view.id} onClose={onClose} />}
    </>
  )
}

// ---- Compose ----

function parseEmails(text: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const part of text.split(/[\s,;]+/)) {
    const email = part.trim()
    if (!email || seen.has(email.toLowerCase())) continue
    seen.add(email.toLowerCase())
    out.push(email)
  }
  return out
}

function ComposeForm({ selectedLeads, onClose, onQueued }: { selectedLeads: CrmLead[]; onClose: () => void; onQueued: (batchId: string) => void }) {
  const { show } = useToast()
  const { data: status, isLoading: statusLoading } = useZeptomailStatus()
  const { data: mappings = [], isLoading: mappingsLoading } = useEmailTemplates()
  const send = useSendBulkEmail()
  const [mappingId, setMappingId] = useState('')
  const [typed, setTyped] = useState('')
  // One key per intended send: a double-click returns the same batch. A failed send gets a new key.
  const [batchKey, setBatchKey] = useState(() => crypto.randomUUID())

  const canType = status?.can_send_custom_emails ?? false
  const withEmail = selectedLeads.filter((l) => l.contact_email)
  const withoutEmail = selectedLeads.length - withEmail.length
  const typedEmails = canType ? parseEmails(typed) : []
  const total = withEmail.length + typedEmails.length

  function handleSend() {
    if (!mappingId) {
      show({ title: 'Choose a template', tone: 'error' })
      return
    }
    if (total === 0) {
      show({ title: 'Select leads with an email address or enter email addresses', tone: 'error' })
      return
    }
    if (total > MAX_RECIPIENTS) {
      show({ title: `You can email at most ${MAX_RECIPIENTS} recipients at a time`, tone: 'error' })
      return
    }
    send.mutate(
      { mappingId, batchKey, leadIds: withEmail.map((l) => l.id), emails: typedEmails },
      {
        onSuccess: (batch) => {
          show({ title: `Sending ${batch.total_count} email${batch.total_count === 1 ? '' : 's'} in the background`, tone: 'success' })
          onQueued(batch.id)
        },
        onError: (err) => {
          setBatchKey(crypto.randomUUID())
          show({ title: err instanceof Error ? err.message : 'Failed to queue the emails', tone: 'error' })
        },
      },
    )
  }

  if (statusLoading || mappingsLoading) {
    return <Dialog.Body><p className="text-[13px] text-[var(--text-muted)]">Loading…</p></Dialog.Body>
  }
  if (!status?.configured) {
    return (
      <Dialog.Body>
        <p className="text-[13px] text-[var(--text-muted)]">ZeptoMail isn't set up yet. Ask an admin to connect it under Control Panel &gt; Integrations.</p>
      </Dialog.Body>
    )
  }

  return (
    <>
      <Dialog.Body>
        <div className="flex flex-col gap-4">
          {mappings.length === 0 ? (
            <p className="text-[13px] text-[var(--text-muted)]">No email templates are enabled yet. Ask an admin to add one.</p>
          ) : (
            <Field label="Template">
              <select className={SELECT_CLASS} value={mappingId} onChange={(e) => setMappingId(e.target.value)}>
                <option value="">Select a template</option>
                {mappings.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <div>
            <p className="mb-1.5 text-[12px] font-medium text-[var(--text-muted)]">Selected leads ({selectedLeads.length})</p>
            {selectedLeads.length === 0 ? (
              <p className="text-[12.5px] text-[var(--text-muted)]">
                None — close this and tick leads on the Contacts list{canType ? ', or enter email addresses below' : ''}.
              </p>
            ) : (
              <ul className="flex max-h-32 flex-col gap-1 overflow-y-auto rounded-lg border border-[var(--border)] p-2">
                {selectedLeads.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-2 text-[12px] text-[var(--text)]">
                    <span className="truncate">{l.contact_name ?? 'Unknown'}</span>
                    {l.contact_email ? (
                      <span className="truncate text-[var(--text-muted)]">{l.contact_email}</span>
                    ) : (
                      <Badge tone="warning">No email — will be skipped</Badge>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {withoutEmail > 0 && (
              <p className="mt-1 text-[11.5px] text-[var(--text-muted)]">
                {withoutEmail} selected lead{withoutEmail === 1 ? ' has' : 's have'} no email address and will be skipped.
              </p>
            )}
          </div>

          {canType && (
            <Field label="Other email addresses" hint="Separate with commas, spaces or new lines. Name and phone merge fields stay empty for these.">
              <Textarea rows={4} value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="a@example.com, b@example.com" />
            </Field>
          )}

          <p className="text-[12.5px] text-[var(--text-h)]">
            {total.toLocaleString()} email{total === 1 ? '' : 's'} will be sent (max {MAX_RECIPIENTS}). Sending runs in the background — you can close this and keep working.
          </p>
        </div>
      </Dialog.Body>
      <Dialog.Footer>
        <Button variant="secondary" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleSend} disabled={send.isPending || mappings.length === 0 || total === 0}>
          {send.isPending ? 'Queuing…' : `Send to ${total}`}
        </Button>
      </Dialog.Footer>
    </>
  )
}

// ---- History ----

const STATUS_LABEL: Record<EmailBatch['status'], string> = { queued: 'Queued', sending: 'Sending', completed: 'Done' }

function HistoryList({ onOpen }: { onOpen: (id: string) => void }) {
  const { data, isLoading } = useEmailBatches()
  const items = data?.items ?? []
  return (
    <Dialog.Body>
      {isLoading ? (
        <p className="text-[13px] text-[var(--text-muted)]">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-[13px] text-[var(--text-muted)]">No bulk emails sent yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((b) => (
            <li key={b.id}>
              <button
                type="button"
                onClick={() => onOpen(b.id)}
                className="flex w-full flex-col gap-1 rounded-lg border border-[var(--border)] px-3 py-2 text-left hover:bg-[var(--surface-hover)]"
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-[13px] font-medium text-[var(--text-h)]">{b.template_label}</span>
                  <Badge tone={b.status === 'completed' ? 'success' : 'neutral'}>{STATUS_LABEL[b.status]}</Badge>
                </span>
                <span className="text-[12px] text-[var(--text-muted)]">
                  {new Date(b.created_at).toLocaleString()}
                  {b.created_by_name ? ` · ${b.created_by_name}` : ''} · {b.sent_count} sent · {b.failed_count} failed · {b.total_count} total
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Dialog.Body>
  )
}

// ---- Progress ----

function BatchProgress({ id, onClose }: { id: string; onClose: () => void }) {
  const { show } = useToast()
  const { data: batch, isLoading } = useEmailBatch(id)
  const retry = useRetryFailedEmails()

  if (isLoading || !batch) {
    return <Dialog.Body><p className="text-[13px] text-[var(--text-muted)]">Loading…</p></Dialog.Body>
  }

  const done = batch.sent_count + batch.failed_count
  const percent = batch.total_count === 0 ? 100 : Math.round((done / batch.total_count) * 100)
  const failed = batch.recipients.filter((r) => r.status === 'failed')

  return (
    <>
      <Dialog.Body>
        <div className="flex flex-col gap-4">
          <div>
            <div className="mb-1.5 flex items-center justify-between text-[12.5px]">
              <span className="font-medium text-[var(--text-h)]">{batch.template_label}</span>
              <span className="text-[var(--text-muted)]">{batch.status === 'completed' ? 'Finished' : batch.status === 'queued' ? 'Waiting to start…' : 'Sending…'}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-hover)]">
              <div className="h-full rounded-full bg-[var(--accent)] transition-all" style={{ width: `${percent}%` }} />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 text-center">
            <Stat label="Total" value={batch.total_count} />
            <Stat label="Sent" value={batch.sent_count} tone="success" />
            <Stat label="Failed" value={batch.failed_count} tone={batch.failed_count > 0 ? 'error' : undefined} />
            <Stat label="Pending" value={batch.pending_count} />
          </div>

          {failed.length > 0 && (
            <div>
              <p className="mb-1.5 text-[12px] font-medium text-[var(--text-muted)]">Failed ({failed.length})</p>
              <ul className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded-lg border border-[var(--border)] p-2">
                {failed.map((r) => (
                  <li key={r.id} className="text-[12px] text-[var(--text)]">
                    <span className="font-medium">{r.to_email}</span>
                    <span className="text-[var(--error)]"> — {r.error ?? 'Failed'}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {batch.skipped.length > 0 && (
            <div>
              <p className="mb-1.5 text-[12px] font-medium text-[var(--text-muted)]">Skipped, never queued ({batch.skipped.length})</p>
              <ul className="flex max-h-32 flex-col gap-1 overflow-y-auto rounded-lg border border-[var(--border)] p-2">
                {batch.skipped.map((s, i) => (
                  <li key={i} className="text-[12px] text-[var(--text-muted)]">
                    {s.email ?? (s.lead_id ? `Lead #${s.lead_id}` : 'Unknown')} — {s.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Dialog.Body>
      <Dialog.Footer>
        {batch.status === 'completed' && batch.failed_count > 0 && (
          <Button
            variant="secondary"
            size="sm"
            disabled={retry.isPending}
            onClick={() =>
              retry.mutate(id, {
                onSuccess: () => show({ title: 'Retrying the failed emails', tone: 'success' }),
                onError: (err) => show({ title: err instanceof Error ? err.message : 'Could not retry', tone: 'error' }),
              })
            }
          >
            {retry.isPending ? 'Queuing…' : `Retry ${batch.failed_count} failed`}
          </Button>
        )}
        <Button size="sm" onClick={onClose}>
          Close
        </Button>
      </Dialog.Footer>
    </>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'success' | 'error' }) {
  const color = tone === 'success' ? 'text-[var(--success)]' : tone === 'error' ? 'text-[var(--error)]' : 'text-[var(--text-h)]'
  return (
    <div className="rounded-lg border border-[var(--border)] px-2 py-2">
      <p className={`text-[18px] font-semibold ${color}`}>{value.toLocaleString()}</p>
      <p className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">{label}</p>
    </div>
  )
}
