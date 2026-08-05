import { AdminAccountManagement } from '@/widgets/admin-account-management'

export default function Accounts() {
  return (
    <div className="account-page mx-auto max-w-[1500px] space-y-5">
      <header className="admin-page-header">
        <div>
          <p className="admin-page-header__eyebrow">Người dùng</p>
          <h1 className="admin-page-header__title">Tài khoản người dùng</h1>
          <p className="admin-page-header__description">
            Quản lý ứng viên, quản trị viên và vòng đời lời mời quản trị.
            Nhà tuyển dụng được quản lý riêng trong khu vực Doanh nghiệp.
          </p>
        </div>
      </header>
      <AdminAccountManagement />
    </div>
  )
}
