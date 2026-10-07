import { useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/useToast'
import { useEmailLogs, useEmailSendForm, useEmailTemplates, useSendLeadEmail, useZeptomailStatus } from '@/api/queries'
import type { EmailLogEntry } from '@/api/crmApi'

const SELECT_CLASS =
  'h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text-h)] outline-none focus:border-[var(--accent-border)]'

const STATUS_TONE: Record<EmailLogEntry['status'], 'success' | 'error' | 'neutral'> = { sent: 'success', failed: 'error', sending: 'neutral' }

interface SendLeadEmailDialogProps {
  open: boolean
  onClose: () => void
  leadId: string
  toEmail: string
}

export function SendLeadEmailDialog({ open, onClose, leadId, toEmail }: SendLeadEmailDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} className="max-w-md">
      <Dialog.Header>
        <Dialog.Title>Send email</Dialog.Title>
        <Dialog.CloseButton onClose={onClose} />
      </Dialog.Header>
      <SendLeadEmailBody leadId={leadId} toEmail={toEmail} onClose={onClose} />
    </Dialog>
  )
}

// Mounted only while the dialog is open, so each opening gets a fresh idempotency key.
function SendLeadEmailBody({ leadId, toEmail, onClose }: { leadId: string; toEmail: string; onClose: () => void }) {
  const { show } = useToast()
  const { data: status, isLoading: statusLoading } = useZeptomailStatus()
  const { data: mappings = [], isLoading: mappingsLoading } = useEmailTemplates()
  const { data: logs } = useEmailLogs(leadId)
  const send = useSendLeadEmail()
  const [mappingId, setMappingId] = useState('')
  // The template's merge fields, pre-filled from the lead where known; the user fills the rest.
  const { data: form, isFetching: formLoading } = useEmailSendForm(mappingId, leadId)
  const [edits, setEdits] = useState<Record<string, string>>({})
  const fields = form?.fields ?? []
  // One key per intended send: a double-click or retried request reuses it so the
  // backend returns the original attempt. A failed send gets a new key (retry = new send).
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID())

  function handleSend() {
    if (!mappingId) {
      show({ title: 'Choose a template', tone: 'error' })
      return
    }
    send.mutate(
      {
        leadId,
        mappingId,
        idempotencyKey,
        ...(fields.length > 0 && { mergeValues: Object.fromEntries(fields.map((f) => [f.name, edits[f.name] ?? f.value])) }),
      },
      {
        onSuccess: () => {
          show({ title: `Email sent to ${toEmail}`, tone: 'success' })
          onClose()
        },
        onError: (err) => {
          setIdempotencyKey(crypto.randomUUID())
          show({ title: err instanceof Error ? err.message : 'Failed to send email', tone: 'error' })
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
          <p className="text-[13px] text-[var(--text-muted)]">
            To: <span className="font-medium text-[var(--text-h)]">{toEmail}</span>
          </p>
          {mappings.length === 0 ? (
            <p className="text-[13px] text-[var(--text-muted)]">No email templates are enabled yet. Ask an admin to add one.</p>
          ) : (
            <Field label="Template">
              <select
                className={SELECT_CLASS}
                value={mappingId}
                onChange={(e) => {
                  setMappingId(e.target.value)
                  setEdits({})
                }}
              >
                <option value="">Select a template</option>
                {mappings.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {mappingId && formLoading && <p className="text-[12px] text-[var(--text-muted)]">Loading template fields…</p>}
          {mappingId && !formLoading && fields.length > 0 && (
            <div className="flex max-h-72 flex-col gap-3 overflow-y-auto pr-1">
              <p className="text-[12px] text-[var(--text-muted)]">Fill in the details for this email. Known details are already filled.</p>
              {fields.map((f) => (
                <Field key={f.name} label={f.name}>
                  <Input value={edits[f.name] ?? f.value} onChange={(e) => setEdits((prev) => ({ ...prev, [f.name]: e.target.value }))} />
                </Field>
              ))}
            </div>
          )}
          {logs && logs.items.length > 0 && (
            <div>
              <p className="mb-1.5 text-[12px] font-medium text-[var(--text-muted)]">Emails sent to this lead</p>
              <ul className="flex max-h-32 flex-col gap-1 overflow-y-auto">
                {logs.items.map((log) => (
                  <li key={log.id} className="flex items-center justify-between gap-2 text-[12px] text-[var(--text)]">
                    <span className="truncate">
                      {log.template_label} · {new Date(log.created_at).toLocaleString()}
                    </span>
                    <Badge tone={STATUS_TONE[log.status]} title={log.error ?? undefined}>
                      {log.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Dialog.Body>
      <Dialog.Footer>
        <Button variant="secondary" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleSend} disabled={send.isPending || mappings.length === 0}>
          {send.isPending ? 'Sending…' : 'Send'}
        </Button>
      </Dialog.Footer>
    </>
  )
}
