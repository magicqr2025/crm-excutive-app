import type { StaffMember } from '@/api/crmApi'

interface AttendeesPickerProps {
  staff: StaffMember[]
  /** Chosen staff ids, excluding the locked one. */
  value: string[]
  onChange: (next: string[]) => void
  /** Always attends (the meeting's assignee): shown checked and disabled. */
  lockedId: string | null
}

export function AttendeesPicker({ staff, value, onChange, lockedId }: AttendeesPickerProps) {
  if (staff.length === 0) return <p className="text-[12.5px] text-[var(--text-muted)]">Loading colleagues…</p>

  function toggle(id: string, checked: boolean) {
    onChange(checked ? [...value, id] : value.filter((v) => v !== id))
  }

  return (
    <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border border-[var(--border)] p-2">
      {staff.map((s) => {
        const locked = s.user_id === lockedId
        const name = `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim() || s.user_id
        return (
          <label key={s.user_id} className="flex items-center gap-2 text-[13px] text-[var(--text-h)]">
            <input
              type="checkbox"
              checked={locked || value.includes(s.user_id)}
              disabled={locked}
              onChange={(e) => toggle(s.user_id, e.target.checked)}
            />
            {name}
            {locked && <span className="text-[11.5px] text-[var(--text-muted)]">(meeting owner)</span>}
          </label>
        )
      })}
    </div>
  )
}
