import { useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ImagePlus, Loader2, Plus, X } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea } from '@/components/ui/Input'
import { PageLoader } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/useToast'
import { useCreateTask, useStaffList, useTask, useTaskTypes, useUpdateTask } from '@/api/queries'
import type { CrmTask, StaffMember, TaskPriority, TaskType } from '@/api/crmApi'
import { useAuthStore } from '@/store/useAuthStore'
import { TaskContactField } from './TaskContactField'
import { useImageUploader } from './taskImages'
import { DEFAULT_TASK_TYPE, SELECT_CLASS, TASK_PRIORITY_OPTIONS, getTaskPermissions, staffLabel, taskTypeOptions, toDatetimeLocalValue } from './taskUi'

const MAX_TASK_IMAGES = 5

/** New task, a copy of one (?copy=<id>), or an edit (/tasks/:id/edit). */
export function TaskFormPage() {
  const { taskId } = useParams()
  const [params] = useSearchParams()
  const copyId = params.get('copy') ?? undefined
  const sourceId = taskId ?? copyId
  const { data: source, isLoading } = useTask(sourceId)
  const { data: staff = [] } = useStaffList()
  const userId = useAuthStore((s) => s.user?.id ?? '')
  const isAdmin = useAuthStore((s) => s.isAdmin)
  const navigate = useNavigate()

  if (sourceId && isLoading) return <PageLoader />
  if (sourceId && !source) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-[14px] font-medium text-[var(--text-h)]">Could not open this task</p>
        <Button size="sm" variant="secondary" onClick={() => navigate('/tasks')}>
          <ArrowLeft size={14} /> Back to tasks
        </Button>
      </div>
    )
  }
  const editing = Boolean(taskId)
  if (editing && source && !getTaskPermissions(source, userId, isAdmin).edit) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-[14px] font-medium text-[var(--text-h)]">You can't edit this task</p>
        <p className="text-[13px] text-[var(--text-muted)]">Only its creator or an admin can edit an open task.</p>
        <Button size="sm" variant="secondary" onClick={() => navigate(`/tasks/${source.id}`)}>
          <ArrowLeft size={14} /> Back to the task
        </Button>
      </div>
    )
  }
  return <TaskForm key={sourceId ?? 'new'} source={source ?? null} editing={editing} staff={staff} userId={userId} />
}

function TaskForm({ source, editing, staff, userId }: { source: CrmTask | null; editing: boolean; staff: StaffMember[]; userId: string }) {
  const navigate = useNavigate()
  const { show } = useToast()
  const { data: types = [] } = useTaskTypes()
  const createTask = useCreateTask()
  const updateTask = useUpdateTask()

  const [title, setTitle] = useState(source?.title ?? '')
  const [taskType, setTaskType] = useState<TaskType>(source?.task_type && source.task_type !== 'ticket' ? source.task_type : DEFAULT_TASK_TYPE)
  const [priority, setPriority] = useState<TaskPriority>(source?.priority ?? 'medium')
  // A copy starts without a deadline: the old one is usually in the past.
  const [deadline, setDeadline] = useState(editing && source?.deadline ? toDatetimeLocalValue(source.deadline) : '')
  const [assignee, setAssignee] = useState(editing ? (source?.assign_to_staff_id ?? userId) : userId)
  const [contactId, setContactId] = useState('')
  const [remark, setRemark] = useState(source?.remark ?? '')
  const [images, setImages] = useState<string[]>(source?.image_urls ?? [])
  const [subtasks, setSubtasks] = useState<string[]>(!editing ? (source?.subtasks ?? []).map((s) => s.title) : [])
  const [subtaskDraft, setSubtaskDraft] = useState('')
  const uploader = useImageUploader(MAX_TASK_IMAGES, images.length)

  const typeChoices = useMemo(() => taskTypeOptions(types, source?.task_type), [types, source?.task_type])
  // A private project's tasks can only go to its members.
  const members = types.find((t) => t.name === taskType)?.member_ids ?? []
  const candidates = members.length > 0 ? staff.filter((s) => members.includes(s.user_id) || s.user_id === assignee) : staff
  const valid = title.trim() !== '' && assignee !== ''
  const saving = createTask.isPending || updateTask.isPending

  function addSubtask() {
    const t = subtaskDraft.trim()
    if (!t) return
    setSubtasks((all) => [...all, t])
    setSubtaskDraft('')
  }

  function submit() {
    if (!valid || saving) return
    const done = {
      onSuccess: (task: CrmTask) => {
        show({ title: editing ? 'Task updated' : 'Task created', tone: 'success' })
        navigate(`/tasks/${task.id}`, { replace: true })
      },
      onError: (err: unknown) => show({ title: err instanceof Error ? err.message : 'Could not save the task', tone: 'error' }),
    }
    if (editing && source) {
      updateTask.mutate(
        {
          id: source.id,
          patch: {
            title: title.trim(),
            taskType,
            priority,
            deadline: deadline || null,
            assignToStaffId: assignee,
            remark: remark.trim(),
            imageUrls: images,
          },
        },
        done,
      )
    } else {
      createTask.mutate(
        {
          title: title.trim(),
          taskType,
          priority,
          deadline: deadline || undefined,
          assignToStaffId: assignee,
          contactId: contactId || undefined,
          remark: remark.trim() || undefined,
          imageUrls: images,
          subtasks,
        },
        done,
      )
    }
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[var(--surface)]">
      <PageHeader
        title={editing ? 'Edit task' : source ? 'Duplicate task' : 'New task'}
        subtitle={editing ? `Task #${source?.id}` : 'Whatever needs doing'}
        action={
          <Button size="sm" variant="secondary" onClick={() => navigate(editing && source ? `/tasks/${source.id}` : '/tasks')}>
            <ArrowLeft size={14} /> Back
          </Button>
        }
      />
      <div className="mx-auto w-full max-w-2xl space-y-4 p-4">
        <Field label="Task *" hint="Whatever needs doing — e.g. “Send quotation for 50 units”.">
          <Textarea value={title} onChange={(e) => setTitle(e.target.value)} rows={3} maxLength={500} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Project">
            <select value={taskType} onChange={(e) => setTaskType(e.target.value)} className={SELECT_CLASS}>
              {typeChoices.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Priority">
            <select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)} className={SELECT_CLASS}>
              {TASK_PRIORITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Deadline" hint="Optional">
          <Input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </Field>

        <Field label="Assign to *">
          <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className={SELECT_CLASS}>
            {candidates.map((s) => (
              <option key={s.user_id} value={s.user_id}>
                {`${staffLabel(staff, s.user_id)}${s.user_id === userId ? ' (me)' : ''}`}
              </option>
            ))}
          </select>
        </Field>

        {!editing ? (
          <Field label="Client" hint="Optional — leave empty for an internal task.">
            <TaskContactField onChange={setContactId} />
          </Field>
        ) : (
          source?.contact_name && (
            <p className="text-[12.5px] text-[var(--text-muted)]">
              Client: <span className="font-medium text-[var(--text-h)]">{source.contact_name}</span>
            </p>
          )
        )}

        <Field label="Remark" hint="Optional — extra detail for whoever does it.">
          <Textarea value={remark} onChange={(e) => setRemark(e.target.value)} rows={3} maxLength={2000} />
        </Field>

        <div>
          <p className="mb-1.5 text-[12.5px] font-medium text-[var(--text-h)]">Images</p>
          {images.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {images.map((url, i) => (
                <span key={url} className="relative">
                  <img src={url} alt={`Image ${i + 1}`} className="h-16 w-16 rounded-md border border-[var(--border)] object-cover" />
                  <button
                    type="button"
                    aria-label={`Remove image ${i + 1}`}
                    onClick={() => setImages((prev) => prev.filter((u) => u !== url))}
                    className="absolute -right-1.5 -top-1.5 rounded-full bg-[var(--surface)] p-0.5 shadow ring-1 ring-[var(--border)]"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
          {uploader.input((urls) => setImages((prev) => [...prev, ...urls]))}
          <Button size="sm" variant="outline" disabled={uploader.uploading || images.length >= MAX_TASK_IMAGES} onClick={uploader.open}>
            {uploader.uploading ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
            {uploader.uploading ? 'Uploading…' : 'Add image'}
          </Button>
          <p className="mt-1 text-[11.5px] text-[var(--text-muted)]">Up to {MAX_TASK_IMAGES} pictures (png, jpg, 5 MB each).</p>
        </div>

        {!editing && (
          <div>
            <p className="mb-1.5 text-[12.5px] font-medium text-[var(--text-h)]">Subtasks</p>
            {subtasks.length > 0 && (
              <ul className="mb-2 space-y-1.5">
                {subtasks.map((t, i) => (
                  <li key={`${t}-${i}`} className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-[13px]">
                    <span className="min-w-0 flex-1 break-words">{t}</span>
                    <button type="button" aria-label={`Remove “${t}”`} onClick={() => setSubtasks((all) => all.filter((_, j) => j !== i))} className="text-[var(--text-muted)] hover:text-[var(--error)]">
                      <X size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <Input
                value={subtaskDraft}
                onChange={(e) => setSubtaskDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addSubtask()
                  }
                }}
                maxLength={300}
                placeholder="Add a subtask"
              />
              <Button type="button" variant="outline" onClick={addSubtask} disabled={!subtaskDraft.trim()} className="shrink-0">
                <Plus size={14} /> Add
              </Button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-[var(--border)] pt-4">
          <Button variant="secondary" size="sm" onClick={() => navigate(editing && source ? `/tasks/${source.id}` : '/tasks')}>
            Cancel
          </Button>
          <Button size="sm" disabled={!valid || saving || uploader.uploading} onClick={submit}>
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Create task'}
          </Button>
        </div>
      </div>
    </div>
  )
}
