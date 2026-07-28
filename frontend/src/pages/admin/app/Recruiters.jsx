import { AdminAccountManagement } from '@/widgets/admin-account-management'

export default function Recruiters() {
  return (
    <div className="space-y-5">
      <header className="admin-page-header">
        <div>
          <p className="admin-page-header__eyebrow">Doanh nghiệp</p>
          <h1 className="admin-page-header__title">Nhà tuyển dụng</h1>
          <p className="admin-page-header__description">
            Tra cứu tài khoản NTD và xử lý hồ sơ xác thực đại diện doanh nghiệp.
          </p>
        </div>
      </header>
      <AdminAccountManagement scope="recruiters" />
    </div>
  )
}
