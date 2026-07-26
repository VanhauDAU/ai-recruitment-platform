import { useParams } from 'react-router-dom'
import { AdminAccountDetail } from '@/widgets/admin-account-detail'

export default function AccountDetail() {
  const { publicId } = useParams()
  return (
    <div className="mx-auto max-w-[1500px]">
      <AdminAccountDetail publicId={publicId} />
    </div>
  )
}
