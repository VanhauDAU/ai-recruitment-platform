import { useParams } from 'react-router-dom'
import { AccountDetailView } from '@/widgets/admin-account-management'

export default function AccountDetail() {
  const { publicId } = useParams()
  return (
    <div className="mx-auto max-w-[1500px]">
      <AccountDetailView publicId={publicId} />
    </div>
  )
}
