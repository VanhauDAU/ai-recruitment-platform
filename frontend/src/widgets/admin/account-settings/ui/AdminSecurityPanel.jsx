import { Card } from 'antd'
import { ChangePasswordForm } from '@/features/common/account/change-password'
import { SessionManager } from '@/features/common/account/session-management'

export default function AdminSecurityPanel() {
  return (
    <div className="space-y-5">
      <Card title="Đổi mật khẩu">
        <ChangePasswordForm defaultLogoutAllSessions />
      </Card>

      <Card title="Thiết bị đang đăng nhập">
        <SessionManager />
      </Card>
    </div>
  )
}
