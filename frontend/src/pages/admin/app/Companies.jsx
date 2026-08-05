import { AdminCompanyWorkspace } from '@/widgets/admin-company-directory'

export default function Companies() {
  return (
    <div className="mx-auto max-w-[1600px] space-y-5">
      <header className="admin-page-header">
        <div>
          <p className="admin-page-header__eyebrow">Doanh nghiệp</p>
          <h1 className="admin-page-header__title">Quản lý công ty</h1>
          <p className="admin-page-header__description">
            Tra cứu pháp nhân, theo dõi đội ngũ nhà tuyển dụng và xử lý các thay đổi trong một nơi.
          </p>
        </div>
      </header>
      <AdminCompanyWorkspace />
    </div>
  )
}
