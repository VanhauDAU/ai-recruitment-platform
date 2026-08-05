import { Alert, Card } from 'antd'
import { useSession } from '@/entities/session'
import { ChangePasswordForm } from '@/features/change-password'
import { SessionManager } from '@/features/session-management'
import { TwoFactorMethodsPanel } from '@/features/two-factor'

export default function AdminSecurityPanel() {
  const { user } = useSession()
  const totpEnabled = Boolean(user?.two_factor_totp_enabled)

  return (
    <div className="space-y-5">
      <Card title="Đổi mật khẩu">
        <ChangePasswordForm defaultLogoutAllSessions />
      </Card>

      <Card title="Xác thực hai yếu tố">
        {!totpEnabled && (
          <Alert
            showIcon
            type="info"
            className="!mb-4"
            message="Nên bật ứng dụng xác thực"
            description="Bổ sung ứng dụng xác thực (TOTP) để bạn vẫn đăng nhập được khi không truy cập được hộp thư."
          />
        )}
        <TwoFactorMethodsPanel />
      </Card>

      <Card title="Thiết bị đang đăng nhập">
        <SessionManager />
      </Card>
    </div>
  )
}
