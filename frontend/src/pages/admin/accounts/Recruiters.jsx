import { AdminAccountManagement } from '@/widgets/admin/account-management'

export default function Recruiters() {
  return (
    <div className="space-y-5">
      <AdminAccountManagement scope="recruiters" />
    </div>
  )
}
