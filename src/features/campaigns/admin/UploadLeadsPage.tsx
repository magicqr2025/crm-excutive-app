import { useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Download, FileSpreadsheet, Upload } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PageLoader } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/useToast'
import { useLabels, useLeadStageTypes, useLeadStatuses } from '@/api/queries'
import { addLabels } from '@/api/leadSetupApi'
import { uploadBody, uploadLeads, type UploadAssignMode, type UploadInput } from '@/api/pipelineLeadsApi'
import type { Pipeline, PipelineAgent } from '@/api/pipelineApi'
import { downloadCsv } from '@/lib/csv'
import { cn } from '@/lib/utils'
import { SaveBar, Section, TeamHeader } from '@/features/team/teamParts'
import { useTeam } from '@/features/team/teamQueries'
import { errorText, staffName } from '@/features/team/teamUtils'
import { StageStatusFields, type StageStatus } from './StageStatusFields'
import { offReason } from './pipelineText'
import { usePipeline, usePipelineAgents } from './pipelineQueries'
import { MAX_UPLOAD_BYTES, readUploadFile, type UploadFileResult } from './uploadFile'

export function UploadLeadsPage() {
  const { campaignId = '' } = useParams<{ campaignId: string }>()
  const [params, setParams] = useSearchParams()
  const history = params.get('view') === 'history'
  const pipeline = usePipeline(campaignId)
  const agents = usePipelineAgents(campaignId)

  return (
    <div className="flex h-full flex-col">
      <TeamHeader title="Bulk upload" subtitle={pipeline.data?.name} backTo={`/campaigns/${campaignId}/leads`} />
      <div role="tablist" className="flex shrink-0 gap-1 border-b border-[var(--border)] px-4 md:px-6">
        {[
          { value: false, label: 'New upload' },
          { value: true, label: 'Upload history' },
        ].map((t) => (
          <button
            key={t.label}
            type="button"
            role="tab"
            aria-selected={history === t.value}
            onClick={() => setParams(t.value ? { view: 'history' } : {}, { replace: true })}
            className={cn('-mb-px h-11 border-b-2 px-3 text-[13px] font-medium', history === t.value ? 'border-[var(--accent)] text-[var(--text-h)]' : 'border-transparent text-[var(--text-muted)]')}
          >
            {t.label}
          </button>
        ))}
      </div>
      {pipeline.isLoading || agents.isLoading ? (
        <PageLoader />
      ) : !pipeline.data || !agents.data ? (
        <p className="px-4 py-10 text-center text-[13px] text-[var(--text-muted)]">{errorText(pipeline.error ?? agents.error ?? new Error('Pipeline not found.'))}</p>
      ) : history ? (
        <History pipeline={pipeline.data} />
      ) : (
        <NewUpload pipeline={pipeline.data} agents={agents.data} />
      )}
    </div>
  )
}

function History({ pipeline }: { pipeline: Pipeline }) {
  const files = pipeline.uploaded_files ?? []
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-4 py-4 md:px-6">
        {files.length === 0 ? (
          <p className="py-10 text-center text-[13px] text-[var(--text-muted)]">No files uploaded yet.</p>
        ) : (
          <ul className="space-y-3">
            {files.map((file) => (
              <li key={file.id} className="rounded-2xl bg-[var(--surface)] p-3.5 ring-1 ring-[var(--border)]">
                <div className="flex items-start gap-2.5">
                  <FileSpreadsheet size={17} aria-hidden className="mt-0.5 shrink-0 text-[var(--text-muted)]" />
                  <span className="min-w-0 flex-1">
                    <span className="block break-all text-[13.5px] font-semibold text-[var(--text-h)]">{file.file_name}</span>
                    <span className="block text-[12px] text-[var(--text-muted)]">{new Date(file.created_at).toLocaleString()}</span>
                  </span>
                  <Badge tone={file.status === 'completed' ? 'success' : file.status === 'failed' ? 'error' : 'warning'}>{file.status}</Badge>
                </div>
                <p className="mt-2 text-[12.5px] text-[var(--text)]">
                  <span className="font-mono-num font-semibold">{file.created_count}</span> added · <span className="font-mono-num font-semibold">{file.duplicate_count}</span> duplicates skipped
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

const STEPS = ['Add file', 'Options', 'Review']

function NewUpload({ pipeline, agents }: { pipeline: Pipeline; agents: PipelineAgent[] }) {
  const navigate = useNavigate()
  const toast = useToast()
  const queryClient = useQueryClient()
  const input = useRef<HTMLInputElement>(null)
  const team = useTeam()
  const { data: labels = [] } = useLabels()
  const { data: stages = [] } = useLeadStageTypes()
  const { data: statuses = [] } = useLeadStatuses()

  const [step, setStep] = useState(0)
  const [fileName, setFileName] = useState('')
  const [file, setFile] = useState<UploadFileResult | null>(null)
  // null until the admin chooses: starts on the "New" stage's default status, like Add Lead.
  const [picked, setPicked] = useState<StageStatus | null>(null)
  const newStage = stages.find((s) => s.lead_stage.trim().toLowerCase() === 'new')
  const defaultStatus = statuses.find((s) => s.is_default && s.status !== '0' && s.stage_id === newStage?.id)
  const status: StageStatus = picked ?? (defaultStatus ? { stageId: defaultStatus.stage_id, statusId: defaultStatus.id } : { stageId: '', statusId: '' })
  const [labelIds, setLabelIds] = useState<string[]>([])
  const [newLabel, setNewLabel] = useState('')
  const [assignMode, setAssignMode] = useState<UploadAssignMode>('campaign')
  const [staffIds, setStaffIds] = useState<string[]>([])
  const [result, setResult] = useState<{ created_count: number; duplicate_count: number } | null>(null)

  // Only this pipeline's active staff can be given leads from a file.
  const people = (team.data ?? []).filter((m) => m.status === '1' && pipeline.agent_ids.includes(m.user_id))
  const reasonFor = (id: string) => {
    const agent = agents.find((a) => a.agent_id === id)
    return agent ? offReason(agent) : null
  }
  const nameOf = (id: string) => {
    const member = people.find((m) => m.user_id === id)
    return member ? staffName(member) : 'staff member'
  }

  const request: UploadInput = {
    pipelineId: pipeline.id,
    fileName,
    rows: file?.rows ?? [],
    leadStatusId: status.statusId || undefined,
    labelIds,
    assignMode,
    staffIds: assignMode === 'distribute' || assignMode === 'single' ? staffIds : [],
  }
  const requestBytes = file ? new TextEncoder().encode(uploadBody(request)).length : 0
  const tooBig = requestBytes > MAX_UPLOAD_BYTES
  // About how many of this file's rows fit in one upload, rounded down to a round number.
  const rowsPerFile = tooBig ? Math.max(100, Math.floor((file!.rows.length * MAX_UPLOAD_BYTES) / requestBytes / 100) * 100) : 0
  const fileProblem = file?.error ?? (tooBig ? `This file is too large to upload in one go. Split it into files of about ${rowsPerFile} leads each.` : null)
  const optionsProblem =
    status.stageId && !status.statusId
      ? 'Choose a lead status for that stage, or choose “No status”.'
      : assignMode === 'distribute' && staffIds.length === 0
        ? 'Choose at least one staff member to share the leads between.'
        : assignMode === 'single' && staffIds.length !== 1
          ? 'Choose the staff member to give all leads to.'
          : null

  const upload = useMutation({
    mutationFn: () => uploadLeads(request),
    onSuccess: (data) => {
      setResult(data)
      void queryClient.invalidateQueries()
    },
    onError: (err) => toast.show({ title: errorText(err), tone: 'error' }),
  })
  const createLabel = useMutation({
    mutationFn: (name: string) => addLabels([name]),
    onSuccess: async (made) => {
      await queryClient.invalidateQueries({ queryKey: ['labels'] })
      setLabelIds((ids) => [...new Set([...ids, ...made.map((l) => l.id)])])
      setNewLabel('')
    },
    onError: (err) => toast.show({ title: errorText(err), tone: 'error' }),
  })

  async function pick(chosen: File | undefined) {
    if (!chosen) return
    setFileName(chosen.name)
    try {
      setFile(readUploadFile(await chosen.text()))
    } catch {
      setFile({ rows: [], skipped: 0, error: 'Could not read that file.' })
    }
    // So the same file can be chosen again after fixing it.
    if (input.current) input.current.value = ''
  }

  if (result) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-8">
        <div className="mx-auto max-w-md space-y-4 rounded-2xl bg-[var(--surface)] p-5 text-center ring-1 ring-[var(--border)]">
          <p className="text-[16px] font-semibold text-[var(--text-h)]">Upload finished</p>
          <p className="text-[13.5px] text-[var(--text)]">
            <span className="font-mono-num text-[22px] font-semibold">{result.created_count}</span> leads added
            <br />
            {result.duplicate_count} duplicate{result.duplicate_count === 1 ? '' : 's'} skipped
          </p>
          <Button className="w-full justify-center" onClick={() => navigate(`/campaigns/${pipeline.id}/leads`)}>
            View leads
          </Button>
        </div>
      </div>
    )
  }

  const assignChoices: { value: UploadAssignMode; label: string; text: string }[] = [
    {
      value: 'campaign',
      label: 'Use the pipeline’s rule',
      text: pipeline.distribution_mode === 'on_demand' ? 'Leads stay unassigned until staff take them with Start Calling.' : 'Leads are shared by the pipeline’s own distribution.',
    },
    { value: 'distribute', label: 'Share between chosen staff', text: 'Split equally between the people you pick.' },
    { value: 'single', label: 'Give all to one person', text: 'Every lead in this file goes to them.' },
    { value: 'on_demand', label: 'Leave On Demand', text: 'Unassigned until staff take them with Start Calling.' },
  ]
  const assignSummary =
    assignMode === 'distribute' ? `Shared between ${staffIds.map(nameOf).join(', ')}` : assignMode === 'single' ? `All to ${nameOf(staffIds[0] ?? '')}` : assignChoices.find((c) => c.value === assignMode)!.label

  const canContinue = step === 0 ? !!file && !fileProblem : !optionsProblem && !fileProblem

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-4 md:px-6">
          <ol className="grid grid-cols-3 gap-1.5">
            {STEPS.map((label, i) => (
              <li
                key={label}
                aria-current={i === step ? 'step' : undefined}
                className={cn('rounded-lg border px-2 py-1.5 text-center text-[12px] font-medium', i === step ? 'border-[var(--accent)] bg-[var(--accent-bg)] text-[var(--accent-strong)]' : 'border-[var(--border)] text-[var(--text-muted)]')}
              >
                {i + 1}. {label}
              </li>
            ))}
          </ol>

          {step === 0 && (
            <Section title="CSV file" hint="A header row with Name and Phone.">
              <Button variant="ghost" onClick={() => downloadCsv('sample-leads.csv', [['Name', 'Phone'], ['John Doe', '9876543210'], ['Jane Smith', '9123456780']])}>
                <Download size={14} /> Download sample file
              </Button>
              <button type="button" onClick={() => input.current?.click()} className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-[var(--border)] px-4 py-8 text-center">
                <Upload size={22} className="text-[var(--text-muted)]" />
                <span className="break-all text-[13.5px] font-medium text-[var(--text-h)]">{fileName || 'Choose a CSV file'}</span>
              </button>
              <input ref={input} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => void pick(e.target.files?.[0])} />
              {fileProblem && <p className="text-[12.5px] text-[var(--error)]">{fileProblem}</p>}
              {file && !file.error && (
                <>
                  <p className="text-[13px] text-[var(--text-h)]">
                    <span className="font-semibold">{file.rows.length}</span> lead{file.rows.length === 1 ? '' : 's'} ready
                    {file.skipped > 0 && <span className="text-[var(--warning)]"> · {file.skipped} row{file.skipped === 1 ? '' : 's'} left out (missing name or bad number)</span>}
                  </p>
                  <Preview rows={file.rows} />
                </>
              )}
            </Section>
          )}

          {step === 1 && (
            <>
              <Section title="Lead status" hint="Every lead in this file starts with it.">
                <StageStatusFields value={status} onChange={setPicked} noneLabel="No status" />
              </Section>
              <Section title="Labels" hint="Added to every lead in this file.">
                {labels.length > 0 && (
                  <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
                    {labels.map((l) => {
                      const on = labelIds.includes(l.id)
                      return (
                        <button
                          key={l.id}
                          type="button"
                          aria-pressed={on}
                          onClick={() => setLabelIds((ids) => (on ? ids.filter((x) => x !== l.id) : [...ids, l.id]))}
                          className={cn('h-9 rounded-full border px-3 text-[12.5px]', on ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-[var(--border)] text-[var(--text-h)]')}
                        >
                          {l.name}
                        </button>
                      )
                    })}
                  </div>
                )}
                <div className="flex gap-2">
                  <Input value={newLabel} maxLength={100} onChange={(e) => setNewLabel(e.target.value)} placeholder="New label name" aria-label="New label name" className="h-11 min-w-0 flex-1" />
                  <Button variant="secondary" className="h-11 shrink-0" disabled={!newLabel.trim() || createLabel.isPending} onClick={() => createLabel.mutate(newLabel.trim())}>
                    {createLabel.isPending ? 'Adding…' : 'Add label'}
                  </Button>
                </div>
              </Section>
              <Section title="Assign to staff" hint="This applies to this file only; the pipeline’s settings don’t change.">
                <fieldset className="space-y-2">
                  <legend className="sr-only">Assign to staff</legend>
                  {assignChoices.map((c) => (
                    <label key={c.value} className={cn('flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-3', assignMode === c.value ? 'border-[var(--accent)] bg-[var(--accent-bg)]' : 'border-[var(--border)]')}>
                      <input
                        type="radio"
                        name="upload-assign"
                        checked={assignMode === c.value}
                        onChange={() => {
                          setAssignMode(c.value)
                          setStaffIds([])
                        }}
                        className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
                      />
                      <span>
                        <span className="block text-[13.5px] font-semibold text-[var(--text-h)]">{c.label}</span>
                        <span className="block text-[12px] text-[var(--text-muted)]">{c.text}</span>
                      </span>
                    </label>
                  ))}
                </fieldset>
                {(assignMode === 'distribute' || assignMode === 'single') &&
                  (people.length === 0 ? (
                    <p className="text-[13px] text-[var(--text-muted)]">This pipeline has no active staff. Add them in its settings.</p>
                  ) : (
                    <ul className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)]">
                      {people.map((m) => {
                        const reason = reasonFor(m.user_id)
                        return (
                          <li key={m.user_id}>
                            <label className={cn('flex min-h-11 items-center gap-3 px-3 py-2', reason ? 'opacity-60' : 'cursor-pointer')}>
                              <input
                                type={assignMode === 'single' ? 'radio' : 'checkbox'}
                                name="upload-staff"
                                disabled={!!reason}
                                checked={staffIds.includes(m.user_id)}
                                onChange={(e) =>
                                  setStaffIds((ids) => (assignMode === 'single' ? [m.user_id] : e.target.checked ? [...ids, m.user_id] : ids.filter((x) => x !== m.user_id)))
                                }
                                className="h-4 w-4 accent-[var(--accent)]"
                              />
                              <span className="min-w-0 flex-1 truncate text-[13.5px] text-[var(--text-h)]">{staffName(m)}</span>
                              {reason && <span className="shrink-0 text-[11.5px] text-[var(--warning)]">{reason}</span>}
                            </label>
                          </li>
                        )
                      })}
                    </ul>
                  ))}
              </Section>
            </>
          )}

          {step === 2 && file && (
            <Section title="Check before uploading" hint="Duplicates are checked across all pipelines and skipped.">
              <dl className="divide-y divide-[var(--border)] text-[13.5px]">
                {[
                  ['File', fileName],
                  ['Leads in file', String(file.rows.length)],
                  ['Pipeline', pipeline.name],
                  ['Lead status', statuses.find((s) => s.id === status.statusId)?.lead_status ?? 'No status'],
                  ['Labels', labelIds.length ? labelIds.map((id) => labels.find((l) => l.id === id)?.name ?? '…').join(', ') : 'None'],
                  ['Assignment', assignSummary],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4 py-2.5">
                    <dt className="shrink-0 text-[var(--text-muted)]">{label}</dt>
                    <dd className="min-w-0 break-words text-right font-medium text-[var(--text-h)]">{value}</dd>
                  </div>
                ))}
              </dl>
              {fileProblem && <p className="text-[12.5px] text-[var(--error)]">{fileProblem}</p>}
              <Preview rows={file.rows} />
            </Section>
          )}
        </div>
      </div>

      <SaveBar note={step === 1 && optionsProblem ? <span className="text-[var(--error)]">{optionsProblem}</span> : `Step ${step + 1} of 3`}>
        {step > 0 && (
          <Button variant="secondary" onClick={() => setStep(step - 1)} disabled={upload.isPending}>
            Back
          </Button>
        )}
        {step < 2 ? (
          <Button onClick={() => setStep(step + 1)} disabled={!canContinue}>
            Continue
          </Button>
        ) : (
          <Button onClick={() => upload.mutate()} disabled={!canContinue || upload.isPending}>
            {upload.isPending ? 'Uploading…' : `Upload ${file?.rows.length ?? 0} leads`}
          </Button>
        )}
      </SaveBar>
    </div>
  )
}

const PREVIEW_ROWS = 10

function Preview({ rows }: { rows: { name: string; phone: string }[] }) {
  return (
    <div className="rounded-xl border border-[var(--border)]">
      <ul className="divide-y divide-[var(--border)]">
        {rows.slice(0, PREVIEW_ROWS).map((r, i) => (
          <li key={i} className="flex justify-between gap-3 px-3 py-2 text-[12.5px]">
            <span className="min-w-0 truncate text-[var(--text-h)]">{r.name}</span>
            <span className="shrink-0 font-mono-num text-[var(--text-muted)]">{r.phone}</span>
          </li>
        ))}
      </ul>
      {rows.length > PREVIEW_ROWS && <p className="border-t border-[var(--border)] px-3 py-2 text-[12px] text-[var(--text-muted)]">…and {rows.length - PREVIEW_ROWS} more</p>}
    </div>
  )
}
