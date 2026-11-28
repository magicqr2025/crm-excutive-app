import { useNavigate } from 'react-router-dom'
import { History, Upload, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/Button'

/** Admin buttons for getting leads into a pipeline. */
export function PipelineLeadTools({ pipelineId }: { pipelineId: string }) {
  const navigate = useNavigate()
  const base = `/campaigns/${pipelineId}`
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="secondary" size="sm" onClick={() => navigate(`${base}/upload`)}>
        <Upload size={14} /> Bulk upload
      </Button>
      <Button variant="secondary" size="sm" onClick={() => navigate(`${base}/add-existing`)}>
        <UserPlus size={14} /> Add existing
      </Button>
      <Button variant="ghost" size="sm" onClick={() => navigate(`${base}/upload?view=history`)}>
        <History size={14} /> Upload history
      </Button>
    </div>
  )
}
