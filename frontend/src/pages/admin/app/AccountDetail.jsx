import { useParams } from 'react-router'
import { AdminAccountDetail } from '@/widgets/admin-account-detail'

export default function AccountDetail({ routeScope = 'users' }) {
  const { publicId } = useParams()
  return (
    <div className="mx-auto max-w-[1500px]">
      <AdminAccountDetail publicId={publicId} routeScope={routeScope} />
    </div>
  )
}
