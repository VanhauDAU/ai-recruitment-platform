import { useParams } from 'react-router'
import { AdminCompanyDetail } from '@/widgets/admin/company-directory'

export default function CompanyDetail() {
  const { publicId } = useParams()
  return (
    <div>
      <AdminCompanyDetail publicId={publicId} />
    </div>
  )
}
