import { useRef, useState } from 'react'
import { ImageIcon, Plus, Trash2, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { Dialog } from '@/components/ui/Dialog'
import { useToast } from '@/components/ui/useToast'
import { useAuthStore } from '@/store/useAuthStore'
import { useQuickReplyMutations } from '@/api/queries'
import type { QuickReply, QuickReplyButton } from '@/api/quickRepliesApi'
import { IMAGE_RULES, uploadImage } from '@/lib/cloudMedia'
import { cn } from '@/lib/utils'
import { QuickReplyPreview } from './QuickReplyPreview'

type ButtonMode = 'none' | 'reply' | 'url'

const fieldLabel = 'mb-1.5 block text-[12.5px] font-medium text-[var(--text-h)]'

const choiceClass = (active: boolean) =>
  cn(
    'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12.5px] font-medium transition-colors',
    active ? 'border-[var(--accent-border)] bg-[var(--accent-bg)] text-[var(--accent-strong)]' : 'border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface-hover)]',
  )

/**
 * Create or edit one quick reply: name, an optional picture, the message and up to three buttons, with a live
 * preview. Staff can attach a picture; videos and files can only be added from the admin app.
 */
export function QuickReplyForm({ existing, onDone }: { existing: QuickReply | null; onDone: () => void }) {
  const { create, update } = useQuickReplyMutations()
  const { show } = useToast()
  const businessId = useAuthStore((s) => s.activeBusinessId)
  const fileRef = useRef<HTMLInputElement>(null)

  const firstButton = existing?.buttons[0]
  const [title, setTitle] = useState(existing?.title ?? '')
  const [body, setBody] = useState(existing?.body ?? '')
  const [withImage, setWithImage] = useState(existing?.mediaType === 'image')
  const [mediaUrl, setMediaUrl] = useState<string | null>(existing?.mediaType === 'image' ? existing.mediaUrl : null)
  const [buttonMode, setButtonMode] = useState<ButtonMode>(!firstButton ? 'none' : firstButton.type === 'url' ? 'url' : 'reply')
  const [replyButtons, setReplyButtons] = useState<string[]>(() => {
    const saved = existing?.buttons.filter((b) => b.type === 'reply').map((b) => b.title) ?? []
    return saved.length ? saved : ['']
  })
  const [linkTitle, setLinkTitle] = useState(firstButton?.type === 'url' ? firstButton.title : '')
  const [linkUrl, setLinkUrl] = useState(firstButton?.type === 'url' ? firstButton.url : '')
  const [uploading, setUploading] = useState(false)

  // An existing video or file reply keeps its attachment; only its text and buttons can be changed here.
  const keepsOtherMedia = existing?.mediaType === 'video' || existing?.mediaType === 'document'

  const buttons: QuickReplyButton[] =
    buttonMode === 'reply'
      ? replyButtons.map((t) => t.trim()).filter(Boolean).map((t) => ({ type: 'reply' as const, title: t }))
      : buttonMode === 'url' && linkTitle.trim() && linkUrl.trim()
        ? [{ type: 'url', title: linkTitle.trim(), url: linkUrl.trim() }]
        : []

  const needsImage = withImage && !mediaUrl
  const buttonsIncomplete = buttonMode !== 'none' && buttons.length === 0
  const canSave = title.trim() && body.trim() && !needsImage && !buttonsIncomplete && !uploading
  const saving = create.isPending || update.isPending

  async function handleFile(file: File | undefined) {
    if (!file || !businessId) return
    setUploading(true)
    try {
      setMediaUrl(await uploadImage(businessId, file))
    } catch (e) {
      show({ title: e instanceof Error ? e.message : 'Could not upload the picture', tone: 'error' })
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function save() {
    if (!canSave) return
    const media = keepsOtherMedia
      ? { mediaType: existing.mediaType, mediaUrl: existing.mediaUrl, mediaFilename: existing.mediaFilename }
      : withImage
        ? { mediaType: 'image' as const, mediaUrl, mediaFilename: null }
        : { mediaType: null, mediaUrl: null, mediaFilename: null }
    const input = { title: title.trim(), body: body.trim(), ...media, buttons }
    const done = {
      onSuccess: () => {
        show({ title: existing ? 'Quick reply updated' : 'Quick reply saved', tone: 'success' })
        onDone()
      },
      onError: (e: unknown) => show({ title: e instanceof Error ? e.message : 'Could not save the quick reply', tone: 'error' }),
    }
    if (existing) update.mutate({ id: existing.id, input }, done)
    else create.mutate(input, done)
  }

  return (
    <>
      <Dialog.Body className="space-y-5 bg-[var(--bg)]">
        <div>
          <label className={fieldLabel}>Name</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="e.g. Yearly plans" />
          <p className="mt-1 text-[11.5px] text-[var(--text-muted)]">Only your team sees this.</p>
        </div>

        {keepsOtherMedia ? (
          <p className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[12px] text-[var(--text-muted)]">
            This reply has a {existing.mediaType === 'video' ? 'video' : 'file'} attached. It stays as it is; change it from the admin app.
          </p>
        ) : (
          <div>
            <label className={fieldLabel}>Picture</label>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setWithImage(false)
                  setMediaUrl(null)
                }}
                className={choiceClass(!withImage)}
              >
                <X size={13} /> Text only
              </button>
              <button type="button" onClick={() => setWithImage(true)} className={choiceClass(withImage)}>
                <ImageIcon size={13} /> With a picture
              </button>
            </div>
            {withImage && (
              <div className="mt-2.5 rounded-lg border border-dashed border-[var(--border)] p-3">
                <input ref={fileRef} type="file" accept={IMAGE_RULES.types.join(',')} className="hidden" onChange={(e) => void handleFile(e.target.files?.[0])} />
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="secondary" disabled={uploading} onClick={() => fileRef.current?.click()}>
                    <Upload size={13} /> {uploading ? 'Uploading…' : mediaUrl ? 'Replace picture' : 'Upload picture'}
                  </Button>
                  <span className="text-[11.5px] text-[var(--text-muted)]">{IMAGE_RULES.hint}</span>
                </div>
                {mediaUrl && <p className="mt-1.5 text-[12px] text-[var(--success)]">Picture uploaded</p>}
              </div>
            )}
          </div>
        )}

        <div>
          <label className={fieldLabel}>Message</label>
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} maxLength={1024} placeholder="What the customer receives" />
          <p className="mt-0.5 text-right text-[11px] text-[var(--text-muted)]">{body.length}/1024</p>
        </div>

        <div>
          <label className={fieldLabel}>Buttons</label>
          <div className="flex flex-wrap gap-1.5">
            {([['none', 'None'], ['reply', 'Reply buttons'], ['url', 'Link button']] as const).map(([v, label]) => (
              <button key={v} type="button" onClick={() => setButtonMode(v)} className={choiceClass(buttonMode === v)}>
                {label}
              </button>
            ))}
          </div>
          {buttonMode === 'reply' && (
            <div className="mt-2.5 space-y-1.5">
              {replyButtons.map((t, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <Input value={t} maxLength={20} placeholder={`Button ${i + 1} (max 20 characters)`} onChange={(e) => setReplyButtons((all) => all.map((x, j) => (j === i ? e.target.value : x)))} />
                  {replyButtons.length > 1 && (
                    <button type="button" aria-label="Remove button" onClick={() => setReplyButtons((all) => all.filter((_, j) => j !== i))} className="shrink-0 text-[var(--text-muted)] hover:text-[var(--error)]">
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              ))}
              {replyButtons.length < 3 && (
                <button type="button" onClick={() => setReplyButtons((all) => [...all, ''])} className="flex items-center gap-1 text-[12.5px] font-medium text-[var(--accent-strong)] hover:underline">
                  <Plus size={13} /> Add button
                </button>
              )}
            </div>
          )}
          {buttonMode === 'url' && (
            <div className="mt-2.5 space-y-1.5">
              <Input value={linkTitle} maxLength={20} onChange={(e) => setLinkTitle(e.target.value)} placeholder="Button text (max 20)" />
              <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://…" />
            </div>
          )}
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-hover)] p-4">
          <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Preview</p>
          <QuickReplyPreview
            body={body}
            mediaType={keepsOtherMedia ? existing.mediaType : withImage ? 'image' : null}
            mediaUrl={keepsOtherMedia ? existing.mediaUrl : mediaUrl}
            mediaFilename={keepsOtherMedia ? existing.mediaFilename : null}
            buttons={buttons}
          />
        </div>
      </Dialog.Body>
      <Dialog.Footer>
        <Button variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
        <Button size="sm" disabled={!canSave || saving} onClick={save}>
          {saving ? 'Saving…' : existing ? 'Save changes' : 'Save'}
        </Button>
      </Dialog.Footer>
    </>
  )
}
