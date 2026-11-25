import { Divider } from 'antd'
import { SessionManager } from '@/features/common/account/session-management'
import { DataRequestsPanel } from '@/features/common/privacy/data-requests'

// Trang "Cài đặt bảo mật" (candidate): thiết bị đang đăng nhập và quyền với dữ liệu cá nhân.
export default function SecuritySettings() {
  return (
    <>
      <SessionManager />
      <Divider className="!my-8" />
      <DataRequestsPanel />
    </>
  )
}
