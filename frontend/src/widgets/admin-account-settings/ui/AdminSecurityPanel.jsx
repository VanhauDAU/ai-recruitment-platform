import { Alert, Card } from 'antd'
import { useSession } from '@/entities/session'
import { ChangePasswordForm } from '@/features/change-password'
import { SessionManager } from '@/features/session-management'
import { TwoFactorMethodsPanel } from '@/features/two-factor'
import { adminPath } from '@/shared/config/portals'

const MFA_LOCK_HINT = 'Tài khoản quản trị không tự tắt được phương thức xác thực. Liên hệ quản trị hệ thống nếu cần thay đổi.'

export default function AdminSecurityPanel() {
  const { user } = useSession()
  const totpEnabled = Boolean(user?.two_factor_totp_enabled)

  return (
    <div className="space-y-5">
      <Card title="Đổi mật khẩu">
        <ChangePasswordForm reauthPath={adminPath('/login')} />
      </Card>

      <Card title="Xác thực hai yếu tố">
        {!totpEnabled && (
          <Alert
            showIcon
            type="info"
            className="!mb-4"
            message="Nên bật ứng dụng xác thực"
            description="Tài khoản quản trị đã bắt buộc xác minh qua email. Bổ sung ứng dụng xác thực (TOTP) giúp bạn đăng nhập được cả khi không truy cập được hộp thư."
          />
        )}
        {/* Backend chỉ cho admin BẬT thêm phương thức, không cho tự hạ cấp — panel
            khoá sẵn switch đang bật thay vì để người dùng nhận lỗi 403. */}
        <TwoFactorMethodsPanel canDisableMethods={false} lockedHint={MFA_LOCK_HINT} />
      </Card>

      <Card title="Thiết bị đang đăng nhập">
        <SessionManager />
      </Card>
    </div>
  )
}
