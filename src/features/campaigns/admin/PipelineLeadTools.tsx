import { useNavigate } from 'react-router-dom'
import { History, PhoneCall, Upload, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/Button'

/** Admin buttons on a pipeline's leads list: get leads in, and see its calls. */
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
      <Button variant="secondary" size="sm" onClick={() => navigate(`${base}/call-logs`)}>
        <PhoneCall size={14} /> Call logs
      </Button>
      <Button variant="ghost" size="sm" onClick={() => navigate(`${base}/upload?view=history`)}>
        <History size={14} /> Upload history
      </Button>
    </div>
  )
}
