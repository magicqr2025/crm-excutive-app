import { useRef, useState } from 'react'
import { ImagePlus, Images, Loader2, X } from 'lucide-react'
import { useToast } from '@/components/ui/useToast'
import { useAuthStore } from '@/store/useAuthStore'
import { useSaveTaskWorkImages } from '@/api/queries'
import type { CrmTask } from '@/api/crmApi'
import { IMAGE_RULES, uploadImage } from '@/lib/cloudMedia'

/** Thumbnails that open the full picture in a new tab. */
export function ImageThumbs({ urls }: { urls: string[] }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {urls.map((url, i) => (
        <li key={url}>
          <a href={url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-lg border border-[var(--border)]">
            <img src={url} alt={`Image ${i + 1}`} loading="lazy" className="h-24 w-28 object-cover" />
          </a>
        </li>
      ))}
    </ul>
  )
}

/** Picks pictures and uploads them one by one; the caller decides what to do with the returned links. */
export function useImageUploader(max: number, current: number) {
  const { show } = useToast()
  const businessId = useAuthStore((s) => s.activeBusinessId)
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function pick(files: FileList | null): Promise<string[]> {
    const list = Array.from(files ?? [])
    if (inputRef.current) inputRef.current.value = ''
    if (list.length === 0 || !businessId) return []
    const room = Math.max(0, max - current)
    if (list.length > room) show({ title: `You can attach up to ${max} images`, tone: 'error' })
    setUploading(true)
    const urls: string[] = []
    try {
      for (const file of list.slice(0, room)) urls.push(await uploadImage(businessId, file))
    } catch (err) {
      show({ title: err instanceof Error ? err.message : 'Image upload failed', tone: 'error' })
    } finally {
      setUploading(false)
    }
    return urls
  }

  const input = (onUploaded: (urls: string[]) => void) => (
    <input
      ref={inputRef}
      type="file"
      multiple
      accept={IMAGE_RULES.types.join(',')}
      className="hidden"
      onChange={async (e) => {
        const urls = await pick(e.target.files)
        if (urls.length > 0) onUploaded(urls)
      }}
    />
  )

  return { uploading, input, open: () => inputRef.current?.click() }
}

const MAX_WORK_IMAGES = 10

/** The pictures the assignee attaches while working, kept apart from the ones on the task itself. */
export function TaskWorkImages({ task, userId, isAdmin }: { task: CrmTask; userId: string; isAdmin: boolean }) {
  const save = useSaveTaskWorkImages()
  const { show } = useToast()
  const images = task.work_image_urls ?? []
  const uploader = useImageUploader(MAX_WORK_IMAGES, images.length)
  const canWrite = (isAdmin || (userId !== '' && (task.created_by === userId || task.assign_to_staff_id === userId))) && task.status !== 'cancelled'
  const busy = uploader.uploading || save.isPending

  function persist(next: string[], success: string) {
    save.mutate(
      { id: task.id, imageUrls: next },
      {
        onSuccess: () => show({ title: success, tone: 'success' }),
        onError: (err) => show({ title: err instanceof Error ? err.message : 'Could not save the images', tone: 'error' }),
      },
    )
  }

  if (images.length === 0 && !canWrite) return null

  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-sm)]">
      <header className="flex items-center justify-between gap-2 px-4 pb-1 pt-4 sm:px-5">
        <h3 className="flex items-center gap-2 text-[14px] font-semibold text-[var(--text-h)]">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--accent-bg)] text-[var(--accent-strong)]">
            <Images size={15} />
          </span>
          Work photos
        </h3>
        <span className="rounded-full bg-[var(--surface-hover)] px-2 py-0.5 text-[11.5px] font-semibold tabular-nums text-[var(--text-muted)]">
          {images.length === 1 ? '1 image' : `${images.length} images`}
        </span>
      </header>
      <div className="px-4 pb-4 pt-3 sm:px-5">
        {canWrite && uploader.input((urls) => persist([...images, ...urls], urls.length === 1 ? 'Image added' : 'Images added'))}
        {images.length === 0 ? (
          <button
            type="button"
            onClick={uploader.open}
            disabled={busy}
            className="flex w-full flex-col items-center gap-1.5 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-hover)] px-4 py-6 text-center transition-colors hover:border-[var(--accent-border)] disabled:opacity-60"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--accent-strong)] shadow-[var(--shadow-sm)]">
              {busy ? <Loader2 size={17} className="animate-spin" /> : <ImagePlus size={17} />}
            </span>
            <span className="text-[13.5px] font-semibold text-[var(--text-h)]">{busy ? 'Saving…' : 'Upload image'}</span>
            <span className="text-[12px] text-[var(--text-muted)]">No photos yet. Show what you did.</span>
          </button>
        ) : (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {images.map((url, i) => (
              <li key={url} className="group relative aspect-square overflow-hidden rounded-xl border border-[var(--border)]">
                <a href={url} target="_blank" rel="noopener noreferrer" className="block h-full w-full">
                  <img src={url} alt={`Work photo ${i + 1}`} loading="lazy" className="h-full w-full object-cover" />
                </a>
                {canWrite && (
                  <button
                    type="button"
                    aria-label={`Remove image ${i + 1}`}
                    disabled={busy}
                    onClick={() =>
                      persist(
                        images.filter((u) => u !== url),
                        'Image removed',
                      )
                    }
                    className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition hover:bg-[var(--error)] disabled:opacity-60"
                  >
                    <X size={14} />
                  </button>
                )}
              </li>
            ))}
            {canWrite && images.length < MAX_WORK_IMAGES && (
              <li>
                <button
                  type="button"
                  onClick={uploader.open}
                  disabled={busy}
                  className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-hover)] text-[12px] font-medium text-[var(--accent-strong)] transition-colors hover:border-[var(--accent-border)] disabled:opacity-60"
                >
                  {busy ? <Loader2 size={18} className="animate-spin" /> : <ImagePlus size={18} />}
                  {busy ? 'Saving…' : 'Add'}
                </button>
              </li>
            )}
          </ul>
        )}
      </div>
    </section>
  )
}
