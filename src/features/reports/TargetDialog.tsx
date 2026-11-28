import { useState, type FormEvent } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/useToast'
import type { CrmIncentiveSlab } from '@/api/crmApi'
import { rupees } from '@/features/performance/performanceUtils'
import { useSaveTarget } from './reportQueries'
import { targetFigures } from './targetMath'

export interface TargetSubject {
  staffId: string
  name: string
  month: number
  year: number
  /** Money received that month; worked out by the server, never typed. */
  collected: number
  current: { target_amount: number; base_salary: number; incentive_slab: CrmIncentiveSlab[] | null } | null
}

// Text while editing, so a box can be empty instead of jumping to 0.
interface SlabDraft {
  key: number
  from: string
  to: string
  rate: string
}

let nextKey = 0
const draft = (slab?: CrmIncentiveSlab): SlabDraft => ({
  key: ++nextKey,
  from: slab ? String(slab.from) : '',
  to: slab ? String(slab.to) : '',
  rate: slab ? String(slab.rate) : '',
})

/** Set or edit one person's target for one month. Mounted only while open, so it starts from the saved values. */
export function TargetDialog({ subject, onClose }: { subject: TargetSubject; onClose: () => void }) {
  const toast = useToast()
  const save = useSaveTarget()
  const [targetAmount, setTargetAmount] = useState(subject.current ? String(subject.current.target_amount) : '')
  const [baseSalary, setBaseSalary] = useState(subject.current ? String(subject.current.base_salary) : '')
  const [slabs, setSlabs] = useState<SlabDraft[]>(() => {
    const saved = subject.current?.incentive_slab ?? []
    return saved.length ? saved.map(draft) : [draft()]
  })
  const monthLabel = new Date(subject.year, subject.month - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

  // Completely empty rows are ignored; a half-filled one must be finished.
  const used = slabs.filter((s) => s.from || s.to || s.rate)
  const parsed = used.map((s) => ({ from: Number(s.from || 0), to: Number(s.to), rate: Number(s.rate) }))
  const slabError = used.some((s) => !s.to || !s.rate)
    ? 'Fill in “To” and “Rate” for each slab, or clear the row.'
    : parsed.some((s) => s.from < 0 || s.to <= s.from || s.rate < 0 || s.rate > 100)
      ? '“To” must be more than “From”, and the rate between 0 and 100.'
      : null
  const valid = targetAmount.trim() !== '' && baseSalary.trim() !== '' && Number(targetAmount) >= 0 && Number(baseSalary) >= 0 && !slabError
  const preview = targetFigures(Number(baseSalary) || 0, Number(targetAmount) || 0, subject.collected, slabError ? [] : parsed)

  const update = (key: number, patch: Partial<SlabDraft>) => setSlabs((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)))

  function close() {
    if (!save.isPending) onClose()
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!valid || save.isPending) return
    save.mutate(
      {
        staff_id: subject.staffId,
        target_month: subject.month,
        target_year: subject.year,
        target_amount: Number(targetAmount),
        base_salary: Number(baseSalary),
        incentive_slab: parsed,
      },
      {
        onSuccess: () => {
          toast.show({ title: `Target saved for ${subject.name}`, tone: 'success' })
          onClose()
        },
        onError: (err) => toast.show({ title: err instanceof Error ? err.message : 'Could not save the target', tone: 'error' }),
      },
    )
  }

  return (
    <Dialog open onClose={close} className="sm:max-w-xl">
      <Dialog.Header>
        <div className="min-w-0">
          <Dialog.Title className="truncate">Target for {subject.name}</Dialog.Title>
          <p className="text-[12px] text-[var(--text-muted)]">{monthLabel}</p>
        </div>
        <Dialog.CloseButton onClose={close} />
      </Dialog.Header>
      <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
        <Dialog.Body className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Target amount *">
              <Input type="number" inputMode="decimal" min="0" value={targetAmount} onChange={(e) => setTargetAmount(e.target.value)} className="h-11" />
            </Field>
            <Field label="Base salary *">
              <Input type="number" inputMode="decimal" min="0" value={baseSalary} onChange={(e) => setBaseSalary(e.target.value)} className="h-11" />
            </Field>
          </div>
          <p className="text-[12px] text-[var(--text-muted)]">
            Collected comes from payments received this month, after refunds: <span className="font-semibold text-[var(--text-h)]">{rupees(subject.collected)}</span>. It can’t be typed in.
          </p>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-medium text-[var(--text-h)]">Incentive slabs</p>
              <button type="button" onClick={() => setSlabs((rows) => [...rows, draft()])} className="flex h-9 items-center gap-1 text-[12.5px] font-medium text-[var(--accent-strong)]">
                <Plus size={13} /> Add slab
              </button>
            </div>
            {slabs.map((slab, i) => (
              <div key={slab.key} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.7fr)_auto] items-end gap-2">
                {(
                  [
                    ['from', 'From'],
                    ['to', 'To'],
                    ['rate', 'Rate %'],
                  ] as const
                ).map(([field, label]) => (
                  <label key={field} className="flex min-w-0 flex-col gap-1 text-[12px] text-[var(--text-muted)]">
                    {label}
                    <Input type="number" inputMode="decimal" min="0" value={slab[field]} onChange={(e) => update(slab.key, { [field]: e.target.value })} className="h-11 px-2" />
                  </label>
                ))}
                <button
                  type="button"
                  onClick={() => setSlabs((rows) => (rows.length > 1 ? rows.filter((r) => r.key !== slab.key) : [draft()]))}
                  aria-label={`Remove slab ${i + 1}`}
                  className="flex h-11 w-10 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--error)]"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {slabError && <p className="text-[12px] text-[var(--error)]">{slabError}</p>}
          </div>

          <dl className="grid grid-cols-3 gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-hover)] p-3 text-center">
            {[
              { label: 'Incentive', value: rupees(preview.incentive) },
              { label: 'Final salary', value: rupees(preview.finalSalary) },
              { label: 'Target left', value: rupees(preview.due) },
            ].map((f) => (
              <div key={f.label}>
                <dt className="text-[11px] text-[var(--text-muted)]">{f.label}</dt>
                <dd className="font-mono-num text-[14px] font-semibold text-[var(--text-h)]">{f.value}</dd>
              </div>
            ))}
          </dl>
        </Dialog.Body>
        <Dialog.Footer>
          <Button type="button" variant="secondary" onClick={close} disabled={save.isPending}>
            Cancel
          </Button>
          <Button type="submit" disabled={!valid || save.isPending}>
            {save.isPending ? 'Saving…' : 'Save target'}
          </Button>
        </Dialog.Footer>
      </form>
    </Dialog>
  )
}
