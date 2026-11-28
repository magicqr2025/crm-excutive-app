import { Field } from '@/components/ui/Input'
import { useLeadStageTypes, useLeadStatuses } from '@/api/queries'
import { SELECT_CLASSES } from '@/features/team/teamUtils'

export interface StageStatus {
  stageId: string
  statusId: string
}

/** An optional lead status: the stage is picked first, then one of that stage's statuses. */
export function StageStatusFields({ value, onChange, noneLabel }: { value: StageStatus; onChange: (value: StageStatus) => void; noneLabel: string }) {
  const { data: stages = [] } = useLeadStageTypes()
  const { data: statuses = [] } = useLeadStatuses()
  const inStage = statuses.filter((s) => s.status !== '0' && s.stage_id === value.stageId).sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))

  return (
    <>
      <Field label="Lead stage">
        <select value={value.stageId} onChange={(e) => onChange({ stageId: e.target.value, statusId: '' })} className={SELECT_CLASSES}>
          <option value="">{noneLabel}</option>
          {stages.map((s) => (
            <option key={s.id} value={s.id}>
              {s.lead_stage}
            </option>
          ))}
        </select>
      </Field>
      {value.stageId && (
        <Field label="Lead status">
          <select value={value.statusId} onChange={(e) => onChange({ ...value, statusId: e.target.value })} className={SELECT_CLASSES}>
            <option value="" disabled>
              {inStage.length ? 'Choose…' : 'No statuses in this stage'}
            </option>
            {inStage.map((s) => (
              <option key={s.id} value={s.id}>
                {s.lead_status}
              </option>
            ))}
          </select>
        </Field>
      )}
    </>
  )
}
