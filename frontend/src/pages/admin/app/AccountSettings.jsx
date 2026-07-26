import { IdcardOutlined } from '@ant-design/icons'
import { AdminAccountSettings } from '@/widgets/admin-account-settings'
import { AdminPageHeader } from '@/widgets/admin-workspace'

export default function AdminAccountSettingsPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <AdminPageHeader
        eyebrow="Tài khoản quản trị"
        title="Cài đặt tài khoản"
        description="Hồ sơ, bảo mật, phạm vi quyền và nhật ký hoạt động của tài khoản bạn đang đăng nhập."
        icon={<IdcardOutlined />}
      />
      <AdminAccountSettings />
    </div>
  )
}
