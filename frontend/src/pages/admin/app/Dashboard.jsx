import { useOutletContext } from 'react-router'
import { useSession } from '@/entities/session'
import { AdminDashboardOverview } from '@/widgets/admin-dashboard'

export default function AdminDashboard() {
  const { adminAccess } = useOutletContext() || {}
  const { user } = useSession()
  return (
    <AdminDashboardOverview
      displayName={user?.full_name || user?.email || 'quản trị viên'}
      tierLabel={adminAccess?.isSuperuser ? 'Superuser, toàn quyền hệ thống' : 'Quản trị viên nghiệp vụ'}
    />
  )
}
