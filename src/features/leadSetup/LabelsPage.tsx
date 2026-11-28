import { useRef, useState, type FormEvent } from 'react'
import { Check, Download, Pencil, Trash2, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { useToast } from '@/components/ui/useToast'
import { useLabels } from '@/api/queries'
import type { CrmLabel } from '@/api/crmApi'
import { addLabels, deleteLabel, renameLabel } from '@/api/leadSetupApi'
import { downloadCsv } from '@/lib/csv'
import { readLabelNames, splitNames } from '@/features/contacts/admin/importRows'
import { ConfirmDialog, SetupPage } from './setupParts'
import { useSetupAction } from './useSetupAction'

/** The server takes at most this many per request. */
const MAX_PER_SAVE = 500
const REFRESH = ['labels']

export function LabelsPage() {
  const query = useLabels()
  const labels = query.data ?? []
  const toast = useToast()
  const input = useRef<HTMLInputElement>(null)
  const [text, setText] = useState('')
  const [search, setSearch] = useState('')
  const [deleting, setDeleting] = useState<CrmLabel | null>(null)
  const add = useSetupAction((names: string[]) => addLabels(names), 'Labels saved', REFRESH)
  const remove = useSetupAction((labelId: string) => deleteLabel(labelId), 'Label deleted', REFRESH)
  const names = splitNames(text)

  async function pick(file: File | undefined) {
    if (!file) return
    try {
      const found = readLabelNames(await file.text())
      if (found.length === 0) toast.show({ title: 'No labels found in that file', tone: 'error' })
      // Added to the box, so they can be checked before saving.
      else setText((current) => [...splitNames(current), ...found].join('\n'))
    } catch {
      toast.show({ title: 'Could not read that file', tone: 'error' })
    }
    if (input.current) input.current.value = ''
  }

  const shown = labels.filter((l) => l.name.toLowerCase().includes(search.trim().toLowerCase()))

  return (
    <SetupPage title="Labels" subtitle="Tags your team puts on contacts." query={query} action={null}>
      <section className="space-y-3 rounded-2xl bg-[var(--surface)] p-3.5 ring-1 ring-[var(--border)]">
        <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} aria-label="New labels" placeholder={'One label per line, or separate with commas\nVIP\nWebinar'} />
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => input.current?.click()}>
            <Upload size={13} /> Upload CSV
          </Button>
          <Button variant="ghost" size="sm" onClick={() => downloadCsv('labels-template.csv', [['Label'], ['VIP'], ['Webinar']])}>
            <Download size={13} /> Template
          </Button>
          <input ref={input} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => void pick(e.target.files?.[0])} />
        </div>
        {names.length > MAX_PER_SAVE && <p className="text-[12px] text-[var(--error)]">Add at most {MAX_PER_SAVE} labels at a time.</p>}
        <Button
          className="w-full justify-center"
          disabled={names.length === 0 || names.length > MAX_PER_SAVE || add.isPending}
          onClick={() => add.mutate(names, { onSuccess: () => setText('') })}
        >
          {add.isPending ? 'Adding…' : `Add ${names.length || ''} label${names.length === 1 ? '' : 's'}`}
        </Button>
        <p className="text-[12px] text-[var(--text-muted)]">Labels that already exist are not added twice.</p>
      </section>

      <Input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Search ${labels.length} labels…`} aria-label="Search labels" className="h-11" />
      {shown.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-[var(--text-muted)]">{labels.length === 0 ? 'No labels yet.' : 'No label matches.'}</p>
      ) : (
        <ul className="divide-y divide-[var(--border)] rounded-2xl bg-[var(--surface)] ring-1 ring-[var(--border)]">
          {shown.map((label) => (
            <LabelRow key={label.id} label={label} onDelete={() => setDeleting(label)} />
          ))}
        </ul>
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete label?"
          confirmLabel="Delete"
          busy={remove.isPending}
          onClose={() => setDeleting(null)}
          onConfirm={() => remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
        >
          “{deleting.name}” will be removed from every contact that has it. This can’t be undone.
        </ConfirmDialog>
      )}
    </SetupPage>
  )
}

function LabelRow({ label, onDelete }: { label: CrmLabel; onDelete: () => void }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(label.name)
  const rename = useSetupAction((next: string) => renameLabel(label.id, next), 'Label renamed', REFRESH)
  const icon = 'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg hover:bg-[var(--surface-hover)]'

  function submit(e: FormEvent) {
    e.preventDefault()
    if (name.trim() && !rename.isPending) rename.mutate(name.trim(), { onSuccess: () => setEditing(false) })
  }

  if (editing) {
    return (
      <li>
        <form onSubmit={submit} className="flex items-center gap-1 px-3 py-2">
          <Input value={name} maxLength={100} onChange={(e) => setName(e.target.value)} aria-label="Label name" autoFocus className="min-w-0 flex-1" />
          <button type="submit" aria-label="Save" disabled={!name.trim() || rename.isPending} className={`${icon} text-[var(--accent-strong)]`}>
            <Check size={16} />
          </button>
          <button
            type="button"
            aria-label="Cancel"
            onClick={() => {
              setName(label.name)
              setEditing(false)
            }}
            className={`${icon} text-[var(--text-muted)]`}
          >
            <X size={16} />
          </button>
        </form>
      </li>
    )
  }
  return (
    <li className="flex items-center gap-1 px-3.5 py-1.5">
      <span className="min-w-0 flex-1 truncate text-[14px] text-[var(--text-h)]">{label.name}</span>
      <button type="button" aria-label={`Rename ${label.name}`} onClick={() => setEditing(true)} className={`${icon} text-[var(--text-muted)]`}>
        <Pencil size={15} />
      </button>
      <button type="button" aria-label={`Delete ${label.name}`} onClick={onDelete} className={`${icon} text-[var(--error)]`}>
        <Trash2 size={15} />
      </button>
    </li>
  )
}
