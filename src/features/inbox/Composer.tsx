import { useState } from 'react'
import { AlertTriangle, LayoutTemplate, Send } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { PageLoader } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/Input'
import { useSendableTemplates } from './useInbox'

interface ComposerProps {
  /** WhatsApp only allows free text within 24h of the customer's last message. */
  sessionOpen: boolean
  isSending: boolean
  onSend: (text: string) => void
  onSendTemplate: (templateId: string) => void
}

export function Composer({ sessionOpen, isSending, onSend, onSendTemplate }: ComposerProps) {
  const [value, setValue] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const { data: templates = [], isLoading, isError } = useSendableTemplates(pickerOpen)

  function send() {
    const text = value.trim()
    if (!text || isSending) return
    onSend(text)
    setValue('')
  }

  function pick(templateId: string) {
    setPickerOpen(false)
    onSendTemplate(templateId)
  }

  return (
    <div className="shrink-0 border-t border-[var(--border)] bg-[var(--surface)]">
      {!sessionOpen && (
        <div className="flex items-start gap-2 border-b border-[var(--warning-border)] bg-[var(--warning-bg)] px-3 py-2 text-[12px] text-[var(--warning)]">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>The 24-hour window is closed. WhatsApp only allows a template message now — once they reply you can type freely.</span>
        </div>
      )}

      <div className="flex items-end gap-2 p-3">
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          disabled={isSending}
          aria-label="Send a template"
          title="Send a template"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--accent-strong)] hover:bg-[var(--surface-hover)] disabled:opacity-40"
        >
          <LayoutTemplate size={19} />
        </button>

        {sessionOpen ? (
          <>
            <Textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Type a message…"
              rows={1}
              className="max-h-32 min-h-10 flex-1 rounded-2xl py-2"
            />
            <button
              type="button"
              onClick={send}
              disabled={!value.trim() || isSending}
              aria-label="Send"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--ink)] disabled:opacity-40"
            >
              <Send size={16} />
            </button>
          </>
        ) : (
          <Button className="flex-1" onClick={() => setPickerOpen(true)} disabled={isSending}>
            <LayoutTemplate size={15} /> Send a template
          </Button>
        )}
      </div>

      <Dialog open={pickerOpen} onClose={() => setPickerOpen(false)} className="max-w-md self-center !h-auto rounded-[var(--radius-card)] border border-[var(--border)]">
        <Dialog.Header>
          <Dialog.Title>Send a template</Dialog.Title>
          <Dialog.CloseButton onClose={() => setPickerOpen(false)} />
        </Dialog.Header>
        <Dialog.Body>
          {isLoading ? (
            <PageLoader />
          ) : isError ? (
            <p className="text-[13px] text-[var(--error)]">Couldn't load templates. Close this and try again.</p>
          ) : templates.length === 0 ? (
            <p className="text-[13px] text-[var(--text-muted)]">No templates are ready to send yet. Ask an admin to add an approved one.</p>
          ) : (
            <ul className="space-y-2">
              {templates.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => pick(t.id)}
                    className="w-full rounded-xl border border-[var(--border)] p-3 text-left hover:bg-[var(--surface-hover)]"
                  >
                    <p className="text-[13px] font-semibold text-[var(--text-h)]">{t.name}</p>
                    <p className="mt-0.5 line-clamp-3 text-[12px] text-[var(--text-muted)]">{t.body}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Dialog.Body>
      </Dialog>
    </div>
  )
}
