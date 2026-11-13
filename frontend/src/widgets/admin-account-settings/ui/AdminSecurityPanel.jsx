import { Card } from 'antd'
import { ChangePasswordForm } from '@/features/change-password'
import { SessionManager } from '@/features/session-management'

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
