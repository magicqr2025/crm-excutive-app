import { useRef, useState } from 'react'
import { FileText, Image as ImageIcon, Paperclip, X } from 'lucide-react'
import { useToast } from '@/components/ui/useToast'
import { TICKET_ACCEPT, TICKET_MAX_FILES, TICKET_MAX_FILE_BYTES, fetchTicketAttachment, type TicketAttachment, type TicketCloudFile } from '@/api/ticketsApi'
import { formatFileSize } from './ticketUi'

// The download endpoint needs the session header, so fetch the file as a Blob and open/save that.
export function AttachmentLink({ attachment }: { attachment: TicketAttachment }) {
  const [busy, setBusy] = useState(false)
  const { show } = useToast()
  const isImage = attachment.mime_type.startsWith('image/')
  const Icon = isImage ? ImageIcon : FileText

  async function open() {
    setBusy(true)
    try {
      const blob = await fetchTicketAttachment(attachment.id)
      const url = URL.createObjectURL(blob)
      if (isImage || attachment.mime_type === 'application/pdf') {
        window.open(url, '_blank', 'noopener')
      } else {
        const a = document.createElement('a')
        a.href = url
        a.download = attachment.file_name
        a.click()
      }
      // Give the new tab / download time to read it before releasing.
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (err) {
      show({ title: err instanceof Error ? err.message : 'Could not open the file', tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={open}
      disabled={busy}
      className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-[var(--border)] px-2.5 py-1.5 text-[12.5px] text-[var(--text-h)] hover:bg-[var(--surface-hover)] disabled:opacity-60"
    >
      <Icon size={14} className="shrink-0 text-[var(--text-muted)]" />
      <span className="truncate">{attachment.file_name}</span>
      <span className="shrink-0 text-[var(--text-muted)]">· {formatFileSize(attachment.size)}</span>
    </button>
  )
}

/** Screenshots a customer uploaded on the public ticket page: plain public images, a thumbnail each. */
export function CloudImages({ files }: { files: TicketCloudFile[] }) {
  if (files.length === 0) return null
  return (
    <ul className="mt-3 flex flex-wrap gap-3" aria-label="Screenshots">
      {files.map((f) => (
        <li key={f.id}>
          <a href={f.url} target="_blank" rel="noopener noreferrer" title={`${f.file_name} · ${formatFileSize(f.size)}`} className="block overflow-hidden rounded-lg border border-[var(--border)]">
            <img src={f.url} alt={f.file_name} loading="lazy" className="h-24 w-32 object-cover" />
          </a>
        </li>
      ))}
    </ul>
  )
}

/** Pick up to 5 files (images, PDF, Word, Excel, CSV, text; 5 MB each). The caller keeps the list. */
export function AttachmentPicker({ files, onChange }: { files: File[]; onChange: (files: File[]) => void }) {
  const { show } = useToast()
  const inputRef = useRef<HTMLInputElement>(null)

  function add(list: FileList | null) {
    if (!list) return
    const next = [...files]
    for (const file of Array.from(list)) {
      if (next.length >= TICKET_MAX_FILES) {
        show({ title: `You can attach up to ${TICKET_MAX_FILES} files`, tone: 'error' })
        break
      }
      if (file.size > TICKET_MAX_FILE_BYTES) {
        show({ title: `“${file.name}” is larger than ${TICKET_MAX_FILE_BYTES / 1024 / 1024} MB`, tone: 'error' })
        continue
      }
      next.push(file)
    }
    onChange(next)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="space-y-2">
      <input ref={inputRef} type="file" multiple accept={TICKET_ACCEPT} className="hidden" onChange={(e) => add(e.target.files)} />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={files.length >= TICKET_MAX_FILES}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-[12.5px] font-medium text-[var(--text-h)] hover:bg-[var(--surface-hover)] disabled:opacity-50"
      >
        <Paperclip size={14} /> Attach files
      </button>
      {files.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="inline-flex max-w-full items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-[12px]">
              <span className="truncate">{f.name}</span>
              <span className="shrink-0 text-[var(--text-muted)]">· {formatFileSize(f.size)}</span>
              <button type="button" aria-label={`Remove ${f.name}`} onClick={() => onChange(files.filter((_, j) => j !== i))}>
                <X size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
