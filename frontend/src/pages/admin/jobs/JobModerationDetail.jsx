import { useParams } from 'react-router'
import { AdminJobDetail } from '@/widgets/admin/job-management'

export default function JobModerationDetail() {
  const { publicId } = useParams()
  return (
    <div>
      <AdminJobDetail publicId={publicId} />
    </div>
  )
}
