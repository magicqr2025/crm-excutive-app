import { useRef, useState } from 'react'
import { ImagePlus, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
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
      <header className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
        <h3 className="text-[14px] font-semibold text-[var(--text-h)]">Work photos</h3>
        <span className="text-[12px] text-[var(--text-muted)]">{images.length === 1 ? '1 image' : `${images.length} images`}</span>
      </header>
      <div className="space-y-3 p-4">
        {images.length > 0 ? <ImageThumbs urls={images} /> : <p className="text-[13px] text-[var(--text-muted)]">No photos yet.</p>}
        {canWrite && (
          <div className="space-y-2">
            {uploader.input((urls) => persist([...images, ...urls], urls.length === 1 ? 'Image added' : 'Images added'))}
            <Button size="sm" variant="outline" disabled={busy || images.length >= MAX_WORK_IMAGES} onClick={uploader.open}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
              {busy ? 'Saving…' : 'Upload image'}
            </Button>
            {images.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {images.map((url, i) => (
                  <button
                    key={url}
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      persist(
                        images.filter((u) => u !== url),
                        'Image removed',
                      )
                    }
                    className="flex items-center gap-1 rounded-full border border-[var(--border)] px-2.5 py-1 text-[11.5px] text-[var(--text-muted)] hover:text-[var(--error)] disabled:opacity-60"
                  >
                    <X size={11} /> Remove image {i + 1}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
