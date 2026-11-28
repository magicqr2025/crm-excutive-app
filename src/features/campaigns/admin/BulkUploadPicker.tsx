import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Upload } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'

/** Bulk upload from the Pipelines page. Leads always go into one pipeline, so it is picked first. */
export function BulkUploadPicker({ pipelines }: { pipelines: { id: string; name: string; lead_count: number }[] }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const shown = pipelines.filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase()))

  return (
    <>
      <Button
        size="sm"
        variant="secondary"
        disabled={pipelines.length === 0}
        title={pipelines.length === 0 ? 'Create a pipeline first' : undefined}
        onClick={() => {
          setSearch('')
          setOpen(true)
        }}
      >
        <Upload size={14} />
        Bulk upload
      </Button>
      {open && (
        <Dialog open onClose={() => setOpen(false)} variant="sheet" className="sm:max-w-md">
          <Dialog.Header>
            <Dialog.Title>Upload into which pipeline?</Dialog.Title>
            <Dialog.CloseButton onClose={() => setOpen(false)} />
          </Dialog.Header>
          <Dialog.Body className="space-y-2 px-3 py-3">
            {pipelines.length > 6 && <Input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search pipelines…" aria-label="Search pipelines" className="h-11" />}
            {shown.length === 0 && <p className="py-4 text-center text-[13px] text-[var(--text-muted)]">No pipeline matches.</p>}
            {shown.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => navigate(`/campaigns/${p.id}/upload`)}
                className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-[var(--border)] px-3 py-2.5 text-left hover:bg-[var(--surface-hover)]"
              >
                <span className="min-w-0 flex-1">
                  <span className="block break-words text-[14px] font-medium text-[var(--text-h)]">{p.name}</span>
                  <span className="block text-[12px] text-[var(--text-muted)]">
                    {p.lead_count} lead{p.lead_count === 1 ? '' : 's'}
                  </span>
                </span>
                <ChevronRight size={16} aria-hidden className="shrink-0 text-[var(--text-muted)]" />
              </button>
            ))}
          </Dialog.Body>
        </Dialog>
      )}
    </>
  )
}
