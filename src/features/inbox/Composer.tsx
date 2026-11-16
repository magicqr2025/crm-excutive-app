import { type ChangeEvent, useRef, useState } from 'react'
import { AlertTriangle, Contact, FileText, Image as ImageIcon, LayoutTemplate, MapPin, MessageSquareText, Music, Paperclip, Send, Video, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { PageLoader } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/Input'
import { QuickRepliesDialog } from './QuickRepliesDialog'
import { ShareContactDialog, ShareLocationDialog } from './ShareDialogs'
import type { ShareContactInput, ShareLocationInput } from '@/api/inboxApi'
import { useSendableTemplates } from './useInbox'

interface ComposerProps {
  /** WhatsApp only allows free text within 24h of the customer's last message. */
  sessionOpen: boolean
  isSending: boolean
  onSend: (text: string) => void
  onSendTemplate: (templateId: string) => void
  onSendQuickReply: (quickReplyId: string) => void
  onSendMedia: (file: File, caption?: string) => void
  onSendLocation: (input: ShareLocationInput) => void
  onSendContact: (input: ShareContactInput) => void
}

type FileKind = 'image' | 'video' | 'audio' | 'document'
const MB = 1024 * 1024

// What WhatsApp accepts from a business, per kind, and how big (documents: our server's 20 MB upload cap).
const FILE_RULES: Record<FileKind, { label: string; types: string[]; maxBytes: number; allowed: string; limit: string }> = {
  image: { label: 'Image', types: ['image/jpeg', 'image/png'], maxBytes: 5 * MB, allowed: 'JPG, PNG', limit: '5 MB' },
  video: { label: 'Video', types: ['video/mp4', 'video/3gpp'], maxBytes: 16 * MB, allowed: 'MP4', limit: '16 MB' },
  audio: { label: 'Audio', types: ['audio/mpeg', 'audio/ogg', 'audio/amr', 'audio/aac', 'audio/mp4'], maxBytes: 16 * MB, allowed: 'MP3, OGG', limit: '16 MB' },
  document: {
    label: 'PDF / Document',
    types: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
    ],
    maxBytes: 20 * MB,
    allowed: 'PDF, Word, Excel',
    limit: '20 MB',
  },
}
const FILE_ICONS: Record<FileKind, typeof ImageIcon> = { image: ImageIcon, video: Video, audio: Music, document: FileText }

// Some phones report no type for Office files; fall back to the extension.
const DOC_TYPE_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain',
}

/** A message if the file can't be sent as this kind, else null. */
function fileProblem(kind: FileKind, file: File): string | null {
  const rule = FILE_RULES[kind]
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  const type = file.type || (kind === 'document' ? DOC_TYPE_BY_EXT[ext] : '') || ''
  if (!rule.types.includes(type)) return `“${file.name}” can't be sent as ${rule.label.toLowerCase()}. Allowed: ${rule.allowed}.`
  if (file.size > rule.maxBytes) return `“${file.name}” is ${(file.size / MB).toFixed(1)} MB — the limit is ${rule.limit}.`
  return null
}

export function Composer({ sessionOpen, isSending, onSend, onSendTemplate, onSendQuickReply, onSendMedia, onSendLocation, onSendContact }: ComposerProps) {
  const [value, setValue] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [quickOpen, setQuickOpen] = useState(false)
  const [attachOpen, setAttachOpen] = useState(false)
  const [share, setShare] = useState<'location' | 'contact' | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState('')
  const pickingKind = useRef<FileKind>('image')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { data: templates = [], isLoading, isError } = useSendableTemplates(pickerOpen)

  function send() {
    if (isSending) return
    if (pendingFile) {
      // WhatsApp's caption limit is 1,024 characters.
      onSendMedia(pendingFile, value.trim().slice(0, 1024) || undefined)
      setPendingFile(null)
      setValue('')
      return
    }
    const text = value.trim()
    if (!text) return
    onSend(text)
    setValue('')
  }

  function pickFile(kind: FileKind) {
    setAttachOpen(false)
    const input = fileInputRef.current
    if (!input) return
    pickingKind.current = kind
    const extensions = kind === 'document' ? Object.keys(DOC_TYPE_BY_EXT).map((e) => `.${e}`) : []
    input.accept = [...FILE_RULES[kind].types, ...extensions].join(',')
    input.click()
  }

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const problem = fileProblem(pickingKind.current, file)
    setFileError(problem ?? '')
    setPendingFile(problem ? null : file)
  }

  function openShare(kind: 'location' | 'contact') {
    setAttachOpen(false)
    setShare(kind)
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

      {fileError && (
        <div className="flex items-start justify-between gap-2 border-b border-[var(--border)] px-3 py-2 text-[12px] text-[var(--error)]">
          <span>{fileError}</span>
          <button type="button" onClick={() => setFileError('')} aria-label="Dismiss" className="shrink-0">
            <X size={14} />
          </button>
        </div>
      )}

      {pendingFile && (
        <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--surface-hover)] px-3 py-2">
          <span className="flex min-w-0 items-center gap-1.5 text-[12.5px] text-[var(--text-h)]">
            <Paperclip size={13} className="shrink-0 text-[var(--accent-strong)]" />
            <span className="truncate">{pendingFile.name}</span>
          </span>
          <button type="button" onClick={() => setPendingFile(null)} aria-label="Remove attachment" className="shrink-0 text-[var(--text-muted)]">
            <X size={15} />
          </button>
        </div>
      )}

      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFile} />

      <div className="flex items-end gap-2 p-3">
        {sessionOpen && (
          <button
            type="button"
            onClick={() => setAttachOpen(true)}
            disabled={isSending}
            aria-label="Attach"
            title="Send a file, location or contact"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--accent-strong)] hover:bg-[var(--surface-hover)] disabled:opacity-40"
          >
            <Paperclip size={19} />
          </button>
        )}
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
        <button
          type="button"
          onClick={() => setQuickOpen(true)}
          disabled={isSending}
          aria-label="Quick replies"
          title="Quick replies"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--accent-strong)] hover:bg-[var(--surface-hover)] disabled:opacity-40"
        >
          <MessageSquareText size={19} />
        </button>

        {sessionOpen ? (
          <>
            <Textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={pendingFile ? 'Add a caption (optional)…' : 'Type a message…'}
              rows={1}
              className="max-h-32 min-h-10 flex-1 rounded-2xl py-2"
            />
            <button
              type="button"
              onClick={send}
              disabled={(!value.trim() && !pendingFile) || isSending}
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

      <Dialog
        open={attachOpen}
        onClose={() => setAttachOpen(false)}
        className="max-w-md self-end !h-auto rounded-t-[var(--radius-card)] border border-[var(--border)] sm:self-center sm:rounded-[var(--radius-card)]"
      >
        <Dialog.Header>
          <Dialog.Title>Send</Dialog.Title>
          <Dialog.CloseButton onClose={() => setAttachOpen(false)} />
        </Dialog.Header>
        <Dialog.Body className="grid grid-cols-3 gap-2">
          {(Object.keys(FILE_RULES) as FileKind[]).map((kind) => {
            const Icon = FILE_ICONS[kind]
            return (
              <AttachOption key={kind} icon={<Icon size={22} />} label={FILE_RULES[kind].label} hint={`${FILE_RULES[kind].allowed} · ${FILE_RULES[kind].limit}`} onClick={() => pickFile(kind)} />
            )
          })}
          <AttachOption icon={<MapPin size={22} />} label="Location" onClick={() => openShare('location')} />
          <AttachOption icon={<Contact size={22} />} label="Contact card" onClick={() => openShare('contact')} />
        </Dialog.Body>
      </Dialog>

      {share === 'location' && <ShareLocationDialog onClose={() => setShare(null)} onSubmit={onSendLocation} />}
      {share === 'contact' && <ShareContactDialog onClose={() => setShare(null)} onSubmit={onSendContact} />}

      <QuickRepliesDialog open={quickOpen} onClose={() => setQuickOpen(false)} canSend={sessionOpen} isSending={isSending} onSend={onSendQuickReply} />

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

/** One tile in the "Send" sheet (a file kind, Location or Contact card). */
function AttachOption({ icon, label, hint, onClick }: { icon: React.ReactNode; label: string; hint?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1 rounded-xl border border-[var(--border)] px-2 py-3 text-center hover:bg-[var(--surface-hover)]"
    >
      <span className="text-[var(--accent-strong)]">{icon}</span>
      <span className="text-[12.5px] font-medium text-[var(--text-h)]">{label}</span>
      {hint && <span className="text-[10.5px] leading-tight text-[var(--text-muted)]">{hint}</span>}
    </button>
  )
}
