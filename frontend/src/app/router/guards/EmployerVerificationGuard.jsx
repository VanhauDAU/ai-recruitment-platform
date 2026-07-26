import { useQuery } from '@tanstack/react-query'
import { Alert, Spin } from 'antd'
import { Navigate, Outlet } from 'react-router-dom'
import {
  employerProfileKeys,
  getEmployerProfile,
} from '@/entities/employer-profile'
import { employerAppPath } from '@/shared/config/portals'

export default function EmployerVerificationGuard() {
  const profileQuery = useQuery({
    queryKey: employerProfileKeys.profile,
    queryFn: getEmployerProfile,
  })

  if (profileQuery.isPending) {
    return (
      <div className="flex min-h-48 items-center justify-center" aria-label="Đang kiểm tra xác thực">
        <Spin size="large" />
      </div>
    )
  }
  if (profileQuery.isError) {
    return (
      <Alert
        showIcon
        type="error"
        title="Không thể kiểm tra trạng thái xác thực"
        description="Vui lòng tải lại trang trước khi tiếp tục quản lý tin hoặc hồ sơ ứng viên."
      />
    )
  }
  if (!profileQuery.data?.onboarding?.verification_completed) {
    return <Navigate to={employerAppPath('/employer-verify')} replace />
  }
  return <Outlet />
}
