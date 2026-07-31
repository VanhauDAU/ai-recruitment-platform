import { useParams } from 'react-router'
import { AdminJobDetail } from '@/widgets/admin-job-management'

export default function JobModerationDetail() {
  const { publicId } = useParams()
  return (
    <div className="mx-auto max-w-[1600px]">
      <AdminJobDetail publicId={publicId} />
    </div>
  )
}
