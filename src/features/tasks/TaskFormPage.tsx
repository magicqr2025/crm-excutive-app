import { useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Building2, Check, ImagePlus, Loader2, Plus, X } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea } from '@/components/ui/Input'
import { PageLoader } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/useToast'
import { useCreateTask, useStaffList, useTask, useTaskTypes, useUpdateTask } from '@/api/queries'
import type { CrmTask, StaffMember, TaskPriority, TaskType } from '@/api/crmApi'
import { useAuthStore } from '@/store/useAuthStore'
import { TaskContactField } from './TaskContactField'
import { ActionButton, FactCell } from './TaskCardParts'
import { useImageUploader } from './taskImages'
import { DEFAULT_TASK_TYPE, TASK_PRIORITY_OPTIONS, TASK_STATUS_LABEL, TASK_STATUS_TONE, getTaskPermissions, staffLabel, taskTypeOptions, toDatetimeLocalValue } from './taskUi'

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

// How urgent a task is: four choices side by side, each with its own colour once picked.
const PRIORITY_COLOR: Record<TaskPriority, { bg: string; fg: string; border: string }> = {
  low: { bg: 'var(--surface-hover)', fg: 'var(--text-h)', border: 'var(--border)' },
  medium: { bg: 'var(--info-bg)', fg: 'var(--info)', border: 'var(--info-border)' },
  high: { bg: 'var(--warning-bg)', fg: 'var(--warning)', border: 'var(--warning-border)' },
  urgent: { bg: 'var(--error-bg)', fg: 'var(--error)', border: 'var(--error-border)' },
}

function PrioritySelect({ value, onChange }: { value: TaskPriority; onChange: (v: TaskPriority) => void }) {
  return (
    <div role="radiogroup" aria-label="Priority" className="grid grid-cols-4 gap-1.5">
      {TASK_PRIORITY_OPTIONS.map((o) => {
        const on = o.value === value
        const c = PRIORITY_COLOR[o.value]
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className="h-10 rounded-lg border text-[13px] font-semibold transition-colors"
            style={on ? { background: c.bg, color: c.fg, borderColor: c.border } : { borderColor: 'var(--border)', color: 'var(--text-muted)' }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
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

  const backTo = editing && source ? `/tasks/${source.id}` : '/tasks'
  const cell = 'h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 text-[13.5px] text-[var(--text-h)]'

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <PageHeader
        title={editing ? 'Edit task' : source ? 'Duplicate task' : 'New task'}
        subtitle={editing ? `Task #${source?.id}` : 'Whatever needs doing'}
        action={
          <Button size="sm" variant="secondary" onClick={() => navigate(backTo)}>
            <ArrowLeft size={14} /> Back
          </Button>
        }
      />

      <div className="mx-auto w-full max-w-3xl p-4">
        <section className="relative overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-sm)]">
          <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-[var(--accent)]" />
          <div className="space-y-5 p-4 pt-5 sm:p-5 sm:pt-6">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone="warning">{editing ? 'Editing' : source ? 'Duplicating' : 'New task'}</Badge>
              {editing && source && <Badge tone={TASK_STATUS_TONE[source.status]}>{TASK_STATUS_LABEL[source.status]}</Badge>}
            </div>

            <Field label="Task *" hint="Whatever needs doing — e.g. “Send quotation for 50 units”.">
              <Textarea
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                rows={2}
                maxLength={500}
                className="font-display text-[18px] font-semibold leading-snug"
              />
            </Field>

            <Field label="Priority">
              <PrioritySelect value={priority} onChange={setPriority} />
            </Field>

            <div className="grid divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              <FactCell label="Assigned to">
                <select aria-label="Assign to" value={assignee} onChange={(e) => setAssignee(e.target.value)} className={cell}>
                  {candidates.map((s) => (
                    <option key={s.user_id} value={s.user_id}>
                      {`${staffLabel(staff, s.user_id)}${s.user_id === userId ? ' (me)' : ''}`}
                    </option>
                  ))}
                </select>
              </FactCell>
              <FactCell label="Due">
                <Input aria-label="Deadline" type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="h-10 text-[13.5px]" />
              </FactCell>
              <FactCell label="Project">
                <select aria-label="Project" value={taskType} onChange={(e) => setTaskType(e.target.value)} className={cell}>
                  {typeChoices.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </FactCell>
            </div>

            {!editing ? (
              <Field label="Client" hint="Optional — leave empty for an internal task.">
                <TaskContactField onChange={setContactId} />
              </Field>
            ) : (
              source?.contact_name && (
                <div className="flex min-w-0 items-start gap-2.5">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-hover)] text-[var(--text-muted)]">
                    <Building2 size={14} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Client</p>
                    <p className="break-words text-[13px] font-medium text-[var(--text-h)]">{source.contact_name}</p>
                  </div>
                </div>
              )
            )}

            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-hover)] px-4 py-3">
              <label htmlFor="task-remark" className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
                Remark
              </label>
              <textarea
                id="task-remark"
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                rows={3}
                maxLength={2000}
                placeholder="Optional — extra detail for whoever does it."
                className="block max-h-48 min-h-[64px] w-full resize-none bg-transparent text-[13.5px] leading-relaxed text-[var(--text)] outline-none [field-sizing:content] placeholder:text-[var(--text-muted)]"
              />
            </div>

            <div>
              <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Images</p>
                <p className="text-[11.5px] text-[var(--text-muted)]">
                  {images.length} of {MAX_TASK_IMAGES} · png, jpg, 5 MB each
                </p>
              </div>
              {uploader.input((urls) => setImages((prev) => [...prev, ...urls]))}
              {images.length === 0 ? (
                <button
                  type="button"
                  onClick={uploader.open}
                  disabled={uploader.uploading}
                  className="flex w-full flex-col items-center gap-1.5 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-hover)] px-4 py-6 text-center transition-colors hover:border-[var(--accent-border)] disabled:opacity-60"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--accent-strong)] shadow-[var(--shadow-sm)]">
                    {uploader.uploading ? <Loader2 size={17} className="animate-spin" /> : <ImagePlus size={17} />}
                  </span>
                  <span className="text-[13.5px] font-semibold text-[var(--text-h)]">{uploader.uploading ? 'Uploading…' : 'Upload image'}</span>
                  <span className="text-[12px] text-[var(--text-muted)]">No photos yet. Add pictures that help.</span>
                </button>
              ) : (
                <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {images.map((url, i) => (
                    <li key={url} className="relative aspect-square overflow-hidden rounded-xl border border-[var(--border)]">
                      <img src={url} alt={`Image ${i + 1}`} className="h-full w-full object-cover" />
                      <button
                        type="button"
                        aria-label={`Remove image ${i + 1}`}
                        onClick={() => setImages((prev) => prev.filter((u) => u !== url))}
                        className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition hover:bg-[var(--error)]"
                      >
                        <X size={14} />
                      </button>
                    </li>
                  ))}
                  {images.length < MAX_TASK_IMAGES && (
                    <li>
                      <button
                        type="button"
                        disabled={uploader.uploading}
                        onClick={uploader.open}
                        className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-hover)] text-[12px] font-medium text-[var(--accent-strong)] transition-colors hover:border-[var(--accent-border)] disabled:opacity-60"
                      >
                        {uploader.uploading ? <Loader2 size={18} className="animate-spin" /> : <ImagePlus size={18} />}
                        {uploader.uploading ? 'Uploading…' : 'Add image'}
                      </button>
                    </li>
                  )}
                </ul>
              )}
            </div>

            {!editing && (
              <div>
                <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Subtasks</p>
                {subtasks.length > 0 && (
                  <ul className="mb-2 divide-y divide-[var(--border)]">
                    {subtasks.map((t, i) => (
                      <li key={`${t}-${i}`} className="flex items-center gap-3 py-2.5">
                        <span aria-hidden className="h-5 w-5 shrink-0 rounded-full border-2 border-[var(--border)]" />
                        <span className="min-w-0 flex-1 break-words text-[14px] font-medium leading-snug text-[var(--text-h)]">{t}</span>
                        <button
                          type="button"
                          aria-label={`Remove “${t}”`}
                          onClick={() => setSubtasks((all) => all.filter((_, j) => j !== i))}
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--error-bg)] hover:text-[var(--error)]"
                        >
                          <X size={15} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-hover)] py-1.5 pl-3 pr-1.5 transition-colors focus-within:border-[var(--accent-border)] focus-within:bg-[var(--surface)]">
                  <Plus size={16} className="shrink-0 text-[var(--text-muted)]" />
                  <input
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
                    aria-label="Add a subtask"
                    className="h-8 min-w-0 flex-1 bg-transparent text-[14px] text-[var(--text-h)] outline-none placeholder:text-[var(--text-muted)]"
                  />
                  <button
                    type="button"
                    onClick={addSubtask}
                    disabled={!subtaskDraft.trim()}
                    className="h-8 shrink-0 rounded-lg bg-[var(--accent)] px-3.5 text-[13px] font-semibold text-[var(--ink)] transition hover:brightness-95 disabled:bg-transparent disabled:text-[var(--text-muted)] disabled:opacity-60"
                  >
                    Add
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 border-t border-[var(--border)] p-4 sm:p-5">
            <ActionButton icon={<X size={15} />} onClick={() => navigate(backTo)}>
              Cancel
            </ActionButton>
            <ActionButton tone="primary" icon={saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} disabled={!valid || saving || uploader.uploading} onClick={submit}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Create task'}
            </ActionButton>
          </div>
        </section>
      </div>
    </div>
  )
}
