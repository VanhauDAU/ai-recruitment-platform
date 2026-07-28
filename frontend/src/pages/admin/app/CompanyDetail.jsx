import { useParams } from 'react-router'
import { AdminCompanyDetail } from '@/widgets/admin-company-directory'

export default function CompanyDetail() {
  const { publicId } = useParams()
  return (
    <div className="mx-auto max-w-[1600px]">
      <AdminCompanyDetail publicId={publicId} />
    </div>
  )
}
