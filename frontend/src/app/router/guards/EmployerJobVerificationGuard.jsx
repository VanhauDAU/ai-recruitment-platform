import { useQuery } from '@tanstack/react-query'
import { Alert, Button } from 'antd'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { getEmployerProfile } from '@/entities/employer-profile'
import { employerAppPath } from '@/shared/config/portals'
import PageLoading from '@/shared/ui/PageLoading'

// Job pages check the latest five-step verification state on every entry.
// The backend remains the authoritative permission boundary when a post is sent.
export default function EmployerJobVerificationGuard({ children }) {
  const { pathname } = useLocation()
  const profileQuery = useQuery({
    queryKey: ['employer', 'job-verification', pathname],
    queryFn: getEmployerProfile,
  })

  if (profileQuery.isLoading) return <PageLoading />

  if (profileQuery.isError) {
    return (
      <div className="mx-auto max-w-xl px-4 py-10">
        <Alert
          showIcon
          type="error"
          message="Không thể kiểm tra trạng thái xác thực"
          description="Vui lòng thử lại trước khi quản lý tin tuyển dụng."
          action={<Button size="small" onClick={() => profileQuery.refetch()}>Thử lại</Button>}
        />
      </div>
    )
  }

  if (!profileQuery.data?.onboarding?.verification_completed) {
    return <Navigate replace to={employerAppPath('/employer-verify')} />
  }

  return children || <Outlet />
}
