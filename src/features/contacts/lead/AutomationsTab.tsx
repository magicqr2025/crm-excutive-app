import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, ChevronDown, Clock, History, Info, MinusCircle, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { PageLoader } from '@/components/ui/Spinner'
import { fetchContactFlowRuns, type FlowRun, type FlowRunStep, type RunOutcome, type RunTrigger, type StepStatus } from '@/api/flowRunsApi'
import { formatDateTime } from '@/lib/dateFormat'
import { cn } from '@/lib/utils'

// Ported from orm-whatsapp's AutomationsTab: every bot automation that ran for this client, newest first, with
// the steps each one performed and where it stopped. The newest run starts open.

const OUTCOME: Record<RunOutcome, { label: string; tone: 'success' | 'warning' | 'error' | 'info' }> = {
  completed: { label: 'Completed', tone: 'success' },
  completed_with_errors: { label: 'Completed with errors', tone: 'warning' },
  waiting: { label: 'Waiting', tone: 'info' },
  failed: { label: 'Stopped: failed', tone: 'error' },
  running: { label: 'Running', tone: 'info' },
  interrupted: { label: 'Interrupted', tone: 'warning' },
}

const STEP: Record<StepStatus, { icon: typeof CheckCircle2; className: string; label: string }> = {
  ok: { icon: CheckCircle2, className: 'text-[var(--success)]', label: 'Done' },
  failed: { icon: XCircle, className: 'text-[var(--error)]', label: 'Failed' },
  waiting: { icon: Clock, className: 'text-[var(--info)]', label: 'Waiting' },
  skipped: { icon: MinusCircle, className: 'text-[var(--warning)]', label: 'Skipped' },
  info: { icon: Info, className: 'text-[var(--text-muted)]', label: 'Note' },
}

function triggerText(run: FlowRun): string {
  const detail = run.trigger_detail ? ` “${run.trigger_detail}”` : ''
  const words: Record<RunTrigger, string> = {
    keyword: `Client wrote${detail}`,
    button_reply: `Client tapped${detail}`,
    delay: 'A delay finished',
    session_reminder: 'Session reminder came due',
    calling_window: 'Calling hours opened',
    voice_call: 'An AI call finished',
    api: 'Started from outside (API)',
  }
  return words[run.trigger] ?? run.trigger
}

function whereItStopped(run: FlowRun): string {
  switch (run.outcome) {
    case 'waiting':
      return run.waiting_text ?? 'Waiting'
    case 'failed':
      return run.stopped_step ? `Stopped at “${run.stopped_step}”` : 'Stopped'
    case 'completed_with_errors':
      return `${run.failed_steps} step${run.failed_steps === 1 ? '' : 's'} failed, the rest ran`
    case 'interrupted':
      return run.stopped_step ? `Cut off after “${run.stopped_step}”` : 'Cut off'
    case 'running':
      return 'Running now'
    default:
      return run.stopped_step ? `Finished after “${run.stopped_step}”` : 'Finished'
  }
}

function CodeChip({ code }: { code: string | null }) {
  if (!code) return null
  return <code className="rounded bg-[var(--surface-hover)] px-1.5 py-0.5 text-[10.5px] font-semibold tracking-wide text-[var(--text-muted)]">{code}</code>
}

function Steps({ steps }: { steps: FlowRunStep[] }) {
  if (steps.length === 0) return <p className="text-[12.5px] text-[var(--text-muted)]">No steps were recorded for this run.</p>
  return (
    <ol className="flex flex-col">
      {steps.map((s, i) => {
        const { icon: Icon, className, label } = STEP[s.status] ?? STEP.info
        return (
          <li key={s.id} className="relative flex gap-3 pb-3 last:pb-0">
            {i < steps.length - 1 && <span aria-hidden className="absolute left-[8px] top-5 h-[calc(100%-12px)] w-px bg-[var(--border)]" />}
            <Icon size={17} className={cn('relative mt-0.5 shrink-0 bg-[var(--surface)]', className)} aria-label={label} />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-[13px] font-medium text-[var(--text-h)]">
                {s.title}
                <span className="text-[11px] font-normal text-[var(--text-muted)]">{label}</span>
                <CodeChip code={s.error_code} />
              </p>
              {s.message && <p className="mt-0.5 break-words text-[12.5px] text-[var(--text)]">{s.message}</p>}
              {s.hint && (
                <p className="mt-1 rounded-md bg-[var(--warning-bg)] px-2.5 py-1.5 text-[12px] text-[var(--text)]">
                  <span className="font-semibold">What to do: </span>
                  {s.hint}
                </p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function RunProblem({ run }: { run: FlowRun }) {
  if (run.outcome === 'waiting' || run.outcome === 'running') {
    return (
      <p className="flex items-start gap-2 rounded-lg border border-[var(--info-border)] bg-[var(--info-bg)] px-3 py-2.5 text-[12.5px] text-[var(--text)]">
        <Clock size={15} className="mt-0.5 shrink-0 text-[var(--info)]" />
        <span>
          {run.waiting_text ?? 'Running'}
          {run.stopped_step ? <> at “{run.stopped_step}”.</> : '.'} It carries on by itself; nothing needs doing.
        </span>
      </p>
    )
  }
  if (run.outcome === 'completed' || (!run.error_code && run.outcome !== 'failed' && run.outcome !== 'interrupted')) return null
  const isError = run.outcome === 'failed'
  return (
    <div className={cn('rounded-lg border px-3 py-2.5 text-[12.5px]', isError ? 'border-[var(--error-border)] bg-[var(--error-bg)]' : 'border-[var(--warning-border)] bg-[var(--warning-bg)]')}>
      <p className="flex flex-wrap items-center gap-2 font-medium text-[var(--text-h)]">
        <AlertTriangle size={14} className={isError ? 'text-[var(--error)]' : 'text-[var(--warning)]'} />
        {isError ? `Stopped${run.stopped_step ? ` at “${run.stopped_step}”` : ''}` : whereItStopped(run)}
        <CodeChip code={run.error_code} />
      </p>
      {run.error_message && <p className="mt-1 break-words text-[var(--text)]">{run.error_message}</p>}
      {run.hint && (
        <p className="mt-1.5 text-[var(--text)]">
          <span className="font-semibold">What to do: </span>
          {run.hint}
        </p>
      )}
    </div>
  )
}

export function AutomationsTab({ contactId }: { contactId: string }) {
  const { data: runs, isLoading, error } = useQuery({
    queryKey: ['flow-runs', 'contact', contactId],
    queryFn: () => fetchContactFlowRuns(contactId),
    enabled: Boolean(contactId),
    // Keep a run that is still going up to date.
    refetchInterval: (query) => (query.state.data?.some((r) => r.outcome === 'waiting' || r.outcome === 'running') ? 15_000 : false),
  })
  const [open, setOpen] = useState<Record<string, boolean>>({})

  if (isLoading) return <PageLoader />
  if (error) return <p className="py-6 text-center text-[13px] text-[var(--text-muted)]">{error instanceof Error ? error.message : 'Could not load the automation history.'}</p>
  if (!runs || runs.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-[var(--radius-card)] border border-dashed border-[var(--border)] px-4 py-8 text-center">
        <History size={20} className="text-[var(--text-muted)]" />
        <p className="text-[13.5px] font-medium text-[var(--text-h)]">No automations have run for this client</p>
        <p className="max-w-sm text-[12.5px] text-[var(--text-muted)]">When a bot automation (a keyword reply, button flow, reminder or AI call) runs for them, you’ll see what it did here.</p>
      </div>
    )
  }

  return (
    <ul className="space-y-2">
      {runs.map((run, index) => {
        const expanded = open[run.id] ?? index === 0
        const outcome = OUTCOME[run.outcome] ?? OUTCOME.completed
        return (
          <li key={run.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)]">
            <button type="button" onClick={() => setOpen((o) => ({ ...o, [run.id]: !expanded }))} aria-expanded={expanded} className="flex w-full items-start gap-2 p-3 text-left">
              <ChevronDown size={16} className={cn('mt-0.5 shrink-0 text-[var(--text-muted)] transition-transform', !expanded && '-rotate-90')} />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-[14px] font-semibold text-[var(--text-h)]">{run.flow_name}</span>
                  <Badge tone={outcome.tone}>{outcome.label}</Badge>
                </span>
                <span className="mt-0.5 block text-[12px] text-[var(--text-muted)]">
                  {formatDateTime(run.started_at)} · {triggerText(run)} · {whereItStopped(run)}
                </span>
              </span>
            </button>
            {expanded && (
              <div className="flex flex-col gap-3 border-t border-[var(--border)] px-3 py-3 pl-9">
                <RunProblem run={run} />
                <Steps steps={run.steps ?? []} />
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
