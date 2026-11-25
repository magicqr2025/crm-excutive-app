import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, AudioLines, CheckCircle2, ChevronDown, Eye, EyeOff, Headphones, Phone, PhoneOff } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Input } from '@/components/ui/Input'
import { PageLoader, Spinner } from '@/components/ui/Spinner'
import { useCan } from '@/store/useAuthStore'
import {
  VOICE_LANGUAGES,
  fetchLeadVoiceCalls,
  fetchVoiceAgents,
  fetchVoiceCall,
  fetchVoiceConnection,
  fetchVoiceRecording,
  startVoiceCall,
  type VoiceCall,
  type VoiceCallDetail,
  type VoiceCallStatus,
  type VoiceLanguage,
} from '@/api/voiceApi'
import { SELECT_CLASS } from '@/features/meetings/meetingUi'
import { formatDateTime } from '@/lib/dateFormat'
import { cn } from '@/lib/utils'

// Ported from orm-whatsapp's LeadVoiceCallsTab: this lead's AI calls, how they went overall, and each call as a
// card that opens in place (summary, what the client wanted, what the CRM did, recording, transcript). The tab is
// only shown to roles with AI Calling (voice_calls); placing a new call needs its "add" right.

type Tone = 'success' | 'info' | 'warning' | 'error' | 'neutral' | 'accent'

const CALL_STATUS: Record<VoiceCallStatus, { label: string; tone: Tone }> = {
  queued: { label: 'In progress', tone: 'info' },
  connected: { label: 'Answered', tone: 'success' },
  no_answer: { label: 'No answer', tone: 'warning' },
  busy: { label: 'Busy', tone: 'warning' },
  failed: { label: 'Failed', tone: 'error' },
}

const INTENT_LABEL: Record<string, string> = {
  wants_meeting: 'Wants a meeting',
  wants_callback: 'Wants a callback',
  interested: 'Interested',
  not_interested: 'Not interested',
  wrong_number: 'Wrong number',
  do_not_call: 'Asked not to be called again',
  payment_promised: 'Promised to pay',
  needs_more_info: 'Needs more information',
}

const ACTION_LABEL: Record<string, string> = {
  label: 'Label',
  pipeline: 'Pipeline',
  assign: 'Assigned',
  status: 'Status',
  followup: 'Follow-up',
  meeting: 'Meeting',
  whatsapp: 'WhatsApp',
}

const MAX_INTENTS_SHOWN = 2

function formatSeconds(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return '—'
  const s = Math.max(0, Math.round(seconds))
  const m = Math.floor(s / 60)
  return m > 0 ? `${m}m ${String(s % 60).padStart(2, '0')}s` : `${s}s`
}

function scoreTone(score: number | null): Tone {
  if (score === null) return 'neutral'
  if (score >= 70) return 'success'
  if (score >= 40) return 'warning'
  return 'neutral'
}

function sentimentTone(sentiment: string | null): Tone {
  if (!sentiment) return 'neutral'
  if (/positive|happy|good/.test(sentiment)) return 'success'
  if (/negative|angry|upset|bad/.test(sentiment)) return 'error'
  return 'neutral'
}

export function AiCallsTab({ leadId, contactName, phone }: { leadId: string; contactName: string; phone: string | null }) {
  const canStart = useCan('voice_calls', 'add')
  const { data: calls, isLoading } = useQuery({ queryKey: ['voice', 'lead-calls', leadId], queryFn: () => fetchLeadVoiceCalls(leadId), enabled: Boolean(leadId) })
  // undefined = nothing chosen yet, so the newest call is open; null = the person closed it.
  const [chosen, setChosen] = useState<string | null | undefined>(undefined)
  const [startOpen, setStartOpen] = useState(false)

  const stats = useMemo(() => {
    const list = calls ?? []
    const answered = list.filter((c) => c.status === 'connected')
    const scored = list.filter((c) => c.score !== null)
    return {
      total: list.length,
      answered: answered.length,
      avgScore: scored.length > 0 ? Math.round(scored.reduce((sum, c) => sum + (c.score ?? 0), 0) / scored.length) : null,
      talkSeconds: answered.reduce((sum, c) => sum + (c.duration_seconds ?? 0), 0),
    }
  }, [calls])

  const startButton = canStart ? (
    <button
      type="button"
      onClick={() => setStartOpen(true)}
      disabled={!phone}
      className="inline-flex h-10 items-center gap-1.5 rounded-full bg-[var(--accent)] px-4 text-[13.5px] font-semibold text-[var(--ink)] hover:bg-[var(--accent-strong)] disabled:opacity-50"
    >
      <AudioLines size={15} /> New AI call
    </button>
  ) : null
  const startDialog = canStart ? <StartCallDialog open={startOpen} onClose={() => setStartOpen(false)} leadId={leadId} name={contactName} phone={phone} /> : null

  if (isLoading) return <PageLoader />
  if (!calls || calls.length === 0) {
    return (
      <>
        <div className="flex flex-col items-center gap-2 rounded-[var(--radius-card)] border border-dashed border-[var(--border)] px-4 py-8 text-center">
          <AudioLines size={20} className="text-[var(--text-muted)]" />
          <p className="text-[13.5px] font-medium text-[var(--text-h)]">No AI calls yet</p>
          <p className="max-w-sm text-[12.5px] text-[var(--text-muted)]">Calls placed to this client by an AI agent show up here with their summary, score, recording and transcript.</p>
          {startButton && <div className="mt-2">{startButton}</div>}
        </div>
        {startDialog}
      </>
    )
  }

  const openId = chosen === undefined ? calls[0].id : chosen

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat label="Calls" value={String(stats.total)} />
        <Stat label="Answered" value={String(stats.answered)} sub={`${stats.total > 0 ? Math.round((stats.answered / stats.total) * 100) : 0}% of calls`} />
        <Stat label="Average score" value={stats.avgScore === null ? '—' : String(stats.avgScore)} sub={stats.avgScore === null ? 'No scored calls' : 'out of 100'} tone={scoreTone(stats.avgScore)} />
        <Stat label="Time on calls" value={formatSeconds(stats.talkSeconds)} sub="answered calls" />
      </div>
      {startButton && <div className="flex justify-end">{startButton}</div>}
      <ul className="space-y-2">
        {calls.map((call) => (
          <CallCard key={call.id} call={call} open={openId === call.id} onToggle={() => setChosen(openId === call.id ? null : call.id)} />
        ))}
      </ul>
      {startDialog}
    </div>
  )
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: Tone }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5">
      <p className="text-[11.5px] text-[var(--text-muted)]">{label}</p>
      <p className={cn('font-mono-num mt-0.5 text-[18px] font-semibold', tone === 'success' ? 'text-[var(--success)]' : tone === 'warning' ? 'text-[var(--warning)]' : 'text-[var(--text-h)]')}>{value}</p>
      {sub && <p className="truncate text-[11px] text-[var(--text-muted)]">{sub}</p>}
    </div>
  )
}

function CallCard({ call, open, onToggle }: { call: VoiceCall; open: boolean; onToggle: () => void }) {
  const status = CALL_STATUS[call.status]
  const answered = call.status === 'connected'
  const intents = call.intents.map((i) => INTENT_LABEL[i] ?? i)
  return (
    <li className={cn('overflow-hidden rounded-xl border bg-[var(--surface)]', open ? 'border-[var(--accent-border)]' : 'border-[var(--border)]')}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-start gap-3 px-3.5 py-3 text-left hover:bg-[var(--surface-hover)]">
        <span
          className={cn(
            'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
            answered ? 'bg-[var(--success-bg)] text-[var(--success)]' : call.status === 'queued' ? 'bg-[var(--info-bg)] text-[var(--info)]' : 'bg-[var(--surface-hover)] text-[var(--text-muted)]',
          )}
        >
          {answered || call.status === 'queued' ? <Phone size={15} /> : <PhoneOff size={15} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline justify-between gap-x-3">
            <span className="text-[13.5px] font-semibold text-[var(--text-h)]">{call.agent_name ?? 'AI call'}</span>
            <span className="text-[12px] text-[var(--text-muted)]">{formatDateTime(call.started_at ?? call.created_at)}</span>
          </span>
          <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge tone={status.tone}>{status.label}</Badge>
            {answered && <span className="font-mono-num text-[12px] text-[var(--text-muted)]">{formatSeconds(call.duration_seconds)}</span>}
            {call.score !== null && <Badge tone={scoreTone(call.score)}>Score {call.score}</Badge>}
            {call.sentiment && (
              <Badge tone={sentimentTone(call.sentiment)} className="capitalize">
                {call.sentiment}
              </Badge>
            )}
            {intents.slice(0, MAX_INTENTS_SHOWN).map((label) => (
              <Badge key={label} tone="accent">
                {label}
              </Badge>
            ))}
            {intents.length > MAX_INTENTS_SHOWN && <Badge tone="neutral">+{intents.length - MAX_INTENTS_SHOWN}</Badge>}
            {call.has_recording && <Headphones size={13} className="text-[var(--text-muted)]" aria-label="Has a recording" />}
          </span>
          {!open && (call.summary || call.failure_reason) && <span className="mt-1.5 line-clamp-2 block text-[12.5px] text-[var(--text)]">{call.summary ?? call.failure_reason}</span>}
        </span>
        <ChevronDown size={16} className={cn('mt-2 shrink-0 text-[var(--text-muted)] transition-transform', open && 'rotate-180')} />
      </button>
      {open && <CallBody callId={call.id} />}
    </li>
  )
}

/** Everything about one call, loaded when it is opened. */
function CallBody({ callId }: { callId: string }) {
  const { data: call, isLoading, isError } = useQuery({
    queryKey: ['voice', 'call', callId],
    queryFn: () => fetchVoiceCall(callId),
    // A call that hasn't reported back yet is checked again until it does.
    refetchInterval: (query) => (query.state.data?.status === 'queued' ? 8_000 : false),
  })
  return (
    <div className="border-t border-[var(--border)] bg-[var(--bg)] p-3">
      {isLoading ? (
        <PageLoader />
      ) : isError || !call ? (
        <p className="py-4 text-center text-[12.5px] text-[var(--error)]">This call could not be loaded.</p>
      ) : (
        <div className="space-y-3">
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-3">
              <SummaryCard call={call} />
              <AfterCard call={call} />
              {call.has_recording && <RecordingCard key={call.id} callId={call.id} />}
            </div>
            <div className="flex min-w-0 flex-col gap-3">
              <DetailsCard call={call} />
              <VariablesCard title="Collected on the call" entries={Object.entries(call.output_variables ?? {})} empty="The agent did not collect any values on this call." />
              <VariablesCard title="Sent to the agent" entries={Object.entries(call.initial_variables ?? {})} empty="No values were sent." />
            </div>
          </div>
          <TranscriptCard call={call} />
        </div>
      )}
    </div>
  )
}

function Panel({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5">
      {title && <p className="mb-2.5 text-[13px] font-semibold text-[var(--text-h)]">{title}</p>}
      {children}
    </section>
  )
}

function SummaryCard({ call }: { call: VoiceCallDetail }) {
  const status = CALL_STATUS[call.status]
  return (
    <Panel>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={status.tone}>{status.label}</Badge>
        {call.score !== null && <Badge tone={scoreTone(call.score)}>Score {call.score}</Badge>}
        {call.sentiment && (
          <Badge tone={sentimentTone(call.sentiment)} className="capitalize">
            {call.sentiment}
          </Badge>
        )}
        {call.retry_attempt > 0 && <Badge tone="neutral">Retry {call.retry_attempt}</Badge>}
      </div>
      <p className="mt-3 font-mono-num text-[10.5px] uppercase tracking-[0.12em] text-[var(--text-muted)]">Summary</p>
      <p className="mt-1 text-[13.5px] text-[var(--text-h)]">
        {call.summary ??
          (call.status === 'queued'
            ? 'The call is in progress. The result appears here when it ends.'
            : call.status === 'connected'
              ? 'No summary was returned for this call.'
              : (call.failure_reason ?? 'The call was not answered.'))}
      </p>
    </Panel>
  )
}

function AfterCard({ call }: { call: VoiceCallDetail }) {
  const log = call.actions_log ?? []
  const hasInsight = call.intents.length > 0 || call.meeting_time || call.callback_time
  if (!hasInsight && log.length === 0 && call.status !== 'connected') return null
  return (
    <Panel title="What the client wanted">
      {hasInsight ? (
        <div className="flex flex-col gap-2">
          {call.intents.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {call.intents.map((i) => (
                <Badge key={i} tone={i === 'not_interested' || i === 'wrong_number' || i === 'do_not_call' ? 'neutral' : 'accent'}>
                  {INTENT_LABEL[i] ?? i}
                </Badge>
              ))}
            </div>
          )}
          {call.meeting_time && <p className="text-[12.5px] text-[var(--text)]">Asked for a meeting on {formatDateTime(call.meeting_time)}.</p>}
          {call.callback_time && <p className="text-[12.5px] text-[var(--text)]">Asked to be called back on {formatDateTime(call.callback_time)}.</p>}
          {call.analysis_source && (
            <p className="text-[11.5px] text-[var(--text-muted)]">{call.analysis_source === 'ai' ? 'Read from the call transcript by AI.' : 'From the values the voice agent returned.'}</p>
          )}
        </div>
      ) : (
        <p className="text-[12.5px] text-[var(--text-muted)]">Nothing specific was picked up from this call.</p>
      )}
      <p className="mb-2 mt-4 text-[13px] font-semibold text-[var(--text-h)]">What the CRM did next</p>
      {log.length === 0 ? (
        <p className="text-[12.5px] text-[var(--text-muted)]">No rule applied to this call.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {log.map((entry, i) => (
            <li key={i} className="flex items-start gap-2 text-[12.5px]">
              {entry.ok ? <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-[var(--success)]" /> : <AlertTriangle size={14} className="mt-0.5 shrink-0 text-[var(--error)]" />}
              <span className="min-w-0 text-[var(--text)]">
                <span className="font-medium text-[var(--text-h)]">{ACTION_LABEL[entry.action] ?? entry.action}:</span> {entry.detail}
                <span className="ml-1.5 text-[11.5px] text-[var(--text-muted)]">· rule “{entry.rule}”</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

function DetailsCard({ call }: { call: VoiceCallDetail }) {
  const [showNumber, setShowNumber] = useState(false)
  const rows: [string, ReactNode][] = [
    [
      'Number',
      <>
        <span className="font-mono-num">{showNumber ? call.phone : call.phone_masked}</span>
        <button type="button" onClick={() => setShowNumber((v) => !v)} className="ml-2 align-middle text-[var(--text-muted)] hover:text-[var(--text-h)]" aria-label={showNumber ? 'Hide number' : 'Show number'}>
          {showNumber ? <EyeOff size={13} /> : <Eye size={13} />}
        </button>
      </>,
    ],
    ['Length', formatSeconds(call.duration_seconds)],
    ['Purpose', call.agent_name ?? '—'],
    ['Campaign', call.campaign_name ?? '—'],
  ]
  if (call.failure_reason) rows.push(['Reason', call.failure_reason])
  return (
    <Panel title="Details">
      <dl className="flex flex-col gap-2.5 text-[13px]">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-start justify-between gap-3">
            <dt className="shrink-0 text-[var(--text-muted)]">{label}</dt>
            <dd className="min-w-0 text-right text-[var(--text-h)]">{value}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  )
}

function VariablesCard({ title, entries, empty }: { title: string; entries: [string, unknown][]; empty: string }) {
  return (
    <Panel title={title}>
      {entries.length === 0 ? (
        <p className="text-[12.5px] text-[var(--text-muted)]">{empty}</p>
      ) : (
        <dl className="flex flex-col gap-2 text-[13px]">
          {entries.map(([key, value]) => (
            <div key={key} className="flex items-start justify-between gap-3">
              <dt className="min-w-0 truncate text-[var(--text-muted)]" title={key}>
                {key}
              </dt>
              <dd className="min-w-0 break-words text-right text-[var(--text-h)]">{typeof value === 'string' ? value : JSON.stringify(value)}</dd>
            </div>
          ))}
        </dl>
      )}
    </Panel>
  )
}

function TranscriptCard({ call }: { call: VoiceCallDetail }) {
  return (
    <Panel title="Transcript">
      {call.transcript && call.transcript.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {call.transcript.map((t, i) => (
            <li key={i} className={cn('flex', t.role === 'user' ? 'justify-end' : 'justify-start')}>
              <div className={cn('max-w-[85%] rounded-2xl px-3.5 py-2 text-[13px]', t.role === 'user' ? 'bg-[var(--accent-bg)] text-[var(--text-h)]' : 'bg-[var(--bg)] text-[var(--text)]')}>
                <p className="mb-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{t.role === 'user' ? 'Client' : 'AI agent'}</p>
                {t.text}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-[var(--text-muted)]">{call.status === 'connected' ? 'No transcript was returned for this call.' : 'There is no conversation to show.'}</p>
      )}
      <p className="mt-3 text-[11.5px] text-[var(--text-muted)]">Transcripts are shown in English, translated if the call was in another language.</p>
    </Panel>
  )
}

function RecordingCard({ callId }: { callId: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url)
    },
    [url],
  )

  async function load() {
    setLoading(true)
    setError(null)
    try {
      setUrl(URL.createObjectURL(await fetchVoiceRecording(callId)))
    } catch {
      setError('The recording could not be loaded. It may not be ready yet.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Panel title="Recording">
      {url ? (
        <audio controls autoPlay src={url} className="w-full" />
      ) : (
        <Button variant="secondary" size="sm" onClick={load} disabled={loading}>
          {loading ? <Spinner size={13} /> : <Headphones size={13} />} {loading ? 'Loading…' : 'Load recording'}
        </Button>
      )}
      {error && <p className="mt-2 text-[12.5px] text-[var(--error)]">{error}</p>}
    </Panel>
  )
}

/* ---------------- Place a new AI call ---------------- */

function StartCallDialog({ open, onClose, leadId, name, phone }: { open: boolean; onClose: () => void; leadId: string; name: string; phone: string | null }) {
  return <Dialog open={open} onClose={onClose}>{open && <StartCallForm leadId={leadId} name={name} phone={phone} onClose={onClose} />}</Dialog>
}

function StartCallForm({ leadId, name, phone, onClose }: { leadId: string; name: string; phone: string | null; onClose: () => void }) {
  const queryClient = useQueryClient()
  const { data: connection } = useQuery({ queryKey: ['voice', 'connection'], queryFn: fetchVoiceConnection })
  const { data: agents = [], isLoading } = useQuery({ queryKey: ['voice', 'agents'], queryFn: fetchVoiceAgents })
  const usable = agents.filter((a) => a.is_active)
  const [agentId, setAgentId] = useState('')
  const [language, setLanguage] = useState<VoiceLanguage | ''>('')
  const [overrides, setOverrides] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const chosenId = agentId || (usable.length === 1 ? usable[0].id : '')
  const agent = usable.find((a) => a.id === chosenId)

  const start = useMutation({
    mutationFn: startVoiceCall,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['voice', 'lead-calls', leadId] }),
  })
  const placed = start.data

  function submit() {
    setError(null)
    if (!chosenId) return setError('Choose what this call is for.')
    const variables = Object.fromEntries(Object.entries(overrides).filter(([, v]) => v.trim() !== ''))
    start.mutate(
      { agent_id: chosenId, lead_id: leadId, ...(language ? { language } : {}), ...(Object.keys(variables).length > 0 ? { variables } : {}) },
      { onError: (e) => setError(e instanceof Error ? e.message : 'Could not place the call') },
    )
  }

  if (placed) {
    return (
      <>
        <Dialog.Header>
          <Dialog.Title>Call placed</Dialog.Title>
          <Dialog.CloseButton onClose={onClose} />
        </Dialog.Header>
        <Dialog.Body className="flex flex-col items-center gap-3 py-6 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent-bg)] text-[var(--accent-strong)]">
            <Phone size={20} />
          </span>
          <p className="text-[14px] font-medium text-[var(--text-h)]">{name}</p>
          <p className="text-[12.5px] text-[var(--text-muted)]">Ringing now. The call shows up in this tab, and its result appears when it ends.</p>
        </Dialog.Body>
        <Dialog.Footer>
          <Button onClick={onClose}>Done</Button>
        </Dialog.Footer>
      </>
    )
  }

  const ready = connection?.configured && usable.length > 0
  return (
    <>
      <Dialog.Header>
        <Dialog.Title>AI call · {name}</Dialog.Title>
        <Dialog.CloseButton onClose={onClose} />
      </Dialog.Header>
      <Dialog.Body className="flex flex-col gap-4">
        {connection && !connection.configured ? (
          <p className="flex items-start gap-2 text-[13px] text-[var(--text)]">
            <AlertTriangle size={15} className="mt-0.5 shrink-0 text-[var(--warning)]" />
            AI calls are not set up for this business yet. Ask your admin to connect them.
          </p>
        ) : isLoading ? (
          <PageLoader />
        ) : usable.length === 0 ? (
          <p className="text-[13px] text-[var(--text)]">There are no call purposes yet. Ask your admin to create one.</p>
        ) : (
          <>
            {phone && <p className="text-[13px] text-[var(--text-muted)]">Calling <span className="font-mono-num">{phone}</span></p>}
            <Field label="What is this call for? *">
              <select className={SELECT_CLASS} value={chosenId} onChange={(e) => setAgentId(e.target.value)}>
                <option value="">Choose a purpose…</option>
                {usable.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Opening language" hint={agent?.language ? `This purpose opens in ${agent.language} by default.` : 'Leave on Default to use the agent’s own setting.'}>
              <select className={SELECT_CLASS} value={language} onChange={(e) => setLanguage(e.target.value as VoiceLanguage | '')}>
                <option value="">Default</option>
                {VOICE_LANGUAGES.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
            {agent && Object.keys(agent.variable_map).length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-[13px] font-medium text-[var(--text-h)]">Values for this call</p>
                <p className="-mt-1 text-[12px] text-[var(--text-muted)]">Filled from the client automatically. Type to change one for this call only.</p>
                {Object.entries(agent.variable_map).map(([key, spec]) => (
                  <div key={key} className="grid grid-cols-[110px_1fr] items-center gap-2">
                    <span className="truncate text-[12.5px] text-[var(--text)]" title={key}>
                      {key}
                    </span>
                    <Input value={overrides[key] ?? ''} onChange={(e) => setOverrides((o) => ({ ...o, [key]: e.target.value }))} placeholder={spec.source === 'fixed' ? (spec.value ?? '') : 'From CRM'} />
                  </div>
                ))}
              </div>
            )}
            {connection && <p className="text-[12px] text-[var(--text-muted)]">Calls are placed between {connection.call_window.start} and {connection.call_window.end} India time.</p>}
            {error && <p className="text-[12.5px] text-[var(--error)]">{error}</p>}
          </>
        )}
      </Dialog.Body>
      {ready && (
        <Dialog.Footer>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={start.isPending || !connection.webhook_ready}>
            <Phone size={14} /> {start.isPending ? 'Calling…' : 'Place call'}
          </Button>
        </Dialog.Footer>
      )}
    </>
  )
}
