import { useState } from 'react'
import { NotebookPen, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { RichTextEditor, RichTextView } from '@/components/ui/RichTextEditor'
import { useToast } from '@/components/ui/useToast'
import { useSaveTaskWorkNotes } from '@/api/queries'
import type { CrmTask } from '@/api/crmApi'
import { formatDeadline } from './taskUi'

interface TaskWorkNotesProps {
  task: CrmTask
  userId: string
  isAdmin: boolean
}

// "Work done": what the person the task is assigned to did and how it works, as rich text. They (or an admin)
// write it; everyone who can see the task reads it. Optional, and hidden when empty for people who can't write.
// This file is copied between orm-whatsapp and executive-webapp.
export function TaskWorkNotes({ task, userId, isAdmin }: TaskWorkNotesProps) {
  const save = useSaveTaskWorkNotes()
  const { show } = useToast()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const canWrite = (isAdmin || task.assign_to_staff_id === userId) && task.status !== 'cancelled'
  const notes = task.work_notes ?? ''
  if (!notes && !canWrite) return null

  function start() {
    setDraft(notes)
    setEditing(true)
  }

  function submit() {
    save.mutate(
      { id: task.id, workNotes: draft.trim() ? draft : null },
      {
        onSuccess: () => {
          show({ title: draft.trim() ? 'Saved' : 'Cleared', tone: 'success' })
          setEditing(false)
        },
        onError: (err) => show({ title: err instanceof Error ? err.message : 'Could not save', tone: 'error' }),
      },
    )
  }

  if (editing) {
    return (
      <div className="mt-3 space-y-2">
        <p className="text-[12px] font-semibold text-[var(--text-h)]">Work done</p>
        <RichTextEditor value={draft} onChange={setDraft} placeholder="What did you do, and how does it work?" disabled={save.isPending} />
        <div className="flex gap-2">
          <Button size="sm" onClick={submit} disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={save.isPending}>
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  if (!notes) {
    return (
      <Button size="sm" variant="outline" className="mt-3" onClick={start}>
        <NotebookPen size={13} /> Add what you did
      </Button>
    )
  }

  return (
    <div className="mt-3 rounded-lg bg-[var(--surface-hover)] p-3">
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-[12px] font-semibold text-[var(--text-h)]">
          Work done
          {task.work_notes_updated_at && (
            <span className="ml-1.5 font-normal text-[var(--text-muted)]">· updated {formatDeadline(task.work_notes_updated_at)}</span>
          )}
        </p>
        {canWrite && (
          <button
            onClick={start}
            title="Edit"
            className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--surface)]"
          >
            <Pencil size={12} />
          </button>
        )}
      </div>
      <RichTextView html={notes} />
    </div>
  )
}
