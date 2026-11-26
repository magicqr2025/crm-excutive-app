import { type ChangeEvent, useRef, useState } from 'react'
import { AlertTriangle, Camera, FileText, Headphones, Images, LayoutTemplate, MapPin, MessageSquareText, Paperclip, Send, UserRound, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { PageLoader } from '@/components/ui/Spinner'
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
// 'gallery' picks a photo or a video, like WhatsApp; the file's own type decides which.
type PickKind = FileKind | 'gallery'

// The attach tray, in WhatsApp's order and colours.
const ATTACH_ITEMS: { id: 'gallery' | 'location' | 'contact' | 'document' | 'audio'; label: string; icon: typeof Images; color: string }[] = [
  { id: 'gallery', label: 'Gallery', icon: Images, color: '#3b82f6' },
  { id: 'location', label: 'Location', icon: MapPin, color: '#10b981' },
  { id: 'contact', label: 'Contact', icon: UserRound, color: '#0ea5e9' },
  { id: 'document', label: 'Document', icon: FileText, color: '#8b5cf6' },
  { id: 'audio', label: 'Audio', icon: Headphones, color: '#f97316' },
]

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
  const pickingKind = useRef<PickKind>('image')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const typing = value.trim() !== ''
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

  function pickFile(kind: PickKind) {
    setAttachOpen(false)
    const input = fileInputRef.current
    if (!input) return
    pickingKind.current = kind
    const extensions = kind === 'document' ? Object.keys(DOC_TYPE_BY_EXT).map((e) => `.${e}`) : []
    // Gallery = photos and videos together, like WhatsApp.
    const types = kind === 'gallery' ? [...FILE_RULES.image.types, ...FILE_RULES.video.types] : FILE_RULES[kind].types
    input.accept = [...types, ...extensions].join(',')
    input.click()
  }

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const picked = pickingKind.current
    const kind: FileKind = picked === 'gallery' ? (file.type.startsWith('video/') ? 'video' : 'image') : picked
    const problem = fileProblem(kind, file)
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
    // Lifted above the page while the attach tray is open, so its backdrop catches taps elsewhere.
    <div className={cn('shrink-0 border-t border-[var(--border)] bg-[var(--surface)]', attachOpen && 'relative z-30 isolate')}>
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
      {/* The 📷 button: opens the phone camera straight away; the photo is checked like any image. */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/jpeg,image/png"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          pickingKind.current = 'image'
          handleFile(e)
        }}
      />

      {sessionOpen ? (
        // WhatsApp-style: one rounded box with the tools inside it, and a round send button beside it.
        <div className="flex items-end gap-2 px-2 py-2">
          <div className="flex min-h-11 min-w-0 flex-1 items-end rounded-[22px] bg-[var(--bg)] px-1 ring-1 ring-[var(--border)] transition-shadow focus-within:ring-2 focus-within:ring-[var(--accent)]">
            <PillButton label="Quick replies" onClick={() => setQuickOpen(true)} disabled={isSending}>
              <MessageSquareText size={21} />
            </PillButton>
            <textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={pendingFile ? 'Add a caption…' : 'Message'}
              rows={1}
              className="max-h-32 min-w-0 flex-1 resize-none bg-transparent px-1 py-[11px] text-[15px] leading-[20px] text-[var(--text-h)] outline-none field-sizing-content placeholder:text-[var(--text-muted)]"
            />
            <PillButton label="Send a file, location or contact" onClick={() => setAttachOpen((v) => !v)} disabled={isSending}>
              <Paperclip size={20} />
            </PillButton>
            {/* Like WhatsApp, these step aside once you start typing so the text has room. */}
            {!typing && (
              <>
                <PillButton label="Send a template" onClick={() => setPickerOpen(true)} disabled={isSending}>
                  <LayoutTemplate size={20} />
                </PillButton>
                <PillButton label="Take a photo" onClick={() => cameraInputRef.current?.click()} disabled={isSending}>
                  <Camera size={21} />
                </PillButton>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={send}
            disabled={(!value.trim() && !pendingFile) || isSending}
            aria-label="Send"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--accent-strong)] text-white dark:from-[#6d4cff] dark:to-[#4c32d9] shadow-[0_8px_18px_-8px_var(--accent)] transition-[opacity,transform] active:scale-95 disabled:opacity-50 disabled:shadow-none"
          >
            <Send size={19} className="-ml-0.5" />
          </button>
        </div>
      ) : (
        <div className="flex items-end gap-2 p-3">
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
          <Button className="flex-1" onClick={() => setPickerOpen(true)} disabled={isSending}>
            <LayoutTemplate size={15} /> Send a template
          </Button>
        </div>
      )}

      {/* WhatsApp-style attach tray: opens under the message box from the 📎 button. */}
      {sessionOpen && attachOpen && (
        <>
          {/* Tap anywhere outside the composer to close it. */}
          <button type="button" aria-label="Close" className="fixed inset-0 -z-10 cursor-default" onClick={() => setAttachOpen(false)} />
          <div className="rounded-t-[22px] border-t border-[var(--border)] bg-[var(--surface)] px-3 pb-4 pt-2">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--border)]" />
            <div className="grid grid-cols-4 gap-y-4">
              {ATTACH_ITEMS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => (item.id === 'location' || item.id === 'contact' ? openShare(item.id) : pickFile(item.id))}
                  className="flex flex-col items-center gap-1.5"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ color: item.color, background: `color-mix(in srgb, ${item.color} 13%, transparent)` }}>
                    <item.icon size={24} strokeWidth={2.2} />
                  </span>
                  <span className="text-[12.5px] text-[var(--text-h)]">{item.label}</span>
                </button>
              ))}
            </div>
            <p className="mt-3 text-center text-[11px] text-[var(--text-muted)]">Photos 5 MB · videos and audio 16 MB · documents 20 MB</p>
          </div>
        </>
      )}

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

/** An icon button inside the WhatsApp-style message box. */
function PillButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="flex h-[42px] w-10 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] hover:text-[var(--text-h)] disabled:opacity-40"
    >
      {children}
    </button>
  )
}
