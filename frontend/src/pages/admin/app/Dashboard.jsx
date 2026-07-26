import {
  AppstoreOutlined,
  CheckCircleOutlined,
  ContactsOutlined,
  FileDoneOutlined,
  FileTextOutlined,
  KeyOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  SolutionOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { Link, useOutletContext } from 'react-router-dom'
import { useSession } from '@/entities/session'
import {
  AdminPageHeader,
  AdminPanel,
  AdminStatCard,
} from '@/widgets/admin-workspace'

const ICONS = {
  access: <KeyOutlined />,
  cv: <FileTextOutlined />,
  dashboard: <AppstoreOutlined />,
  leads: <ContactsOutlined />,
  moderation: <FileDoneOutlined />,
  services: <SolutionOutlined />,
  settings: <SettingOutlined />,
  shield: <SafetyCertificateOutlined />,
}

export default function AdminDashboard() {
  const { user } = useSession()
  const { availableRoutes = [], adminAccess } = useOutletContext() || {}
  const workspaceRoutes = availableRoutes.filter((route) => route.segment !== '/dashboard')
  const displayName = user?.full_name || user?.email?.split('@')[0] || 'quản trị viên'

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Bảng điều khiển"
        description="Tổng quan phạm vi quản trị và lối tắt đến những khu vực bạn được cấp quyền."
        icon={<AppstoreOutlined />}
      />

      <section className="admin-hero">
        <div className="relative z-10 max-w-2xl">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-sky-200">AI Recruitment Admin</p>
          <h2 className="m-0 text-2xl font-bold leading-tight sm:text-3xl">
            Chào {displayName}, sẵn sàng vận hành hệ thống.
          </h2>
          <p className="mb-0 mt-3 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">
            Theo dõi nội dung, dịch vụ, khách hàng và phân quyền từ một không gian làm việc thống nhất.
          </p>
        </div>
        <CheckCircleOutlined className="pointer-events-none absolute -bottom-7 right-6 hidden text-[118px] text-white/[0.06] sm:block" aria-hidden="true" />
      </section>

      <section className="grid gap-4 md:grid-cols-3" aria-label="Tóm tắt quyền truy cập">
        <AdminStatCard
          icon={<AppstoreOutlined />}
          label="Khu vực khả dụng"
          value={availableRoutes.length}
          detail="Theo quyền hiện tại"
        />
        <AdminStatCard
          icon={<TeamOutlined />}
          label="Chức danh hiệu lực"
          value={adminAccess?.memberships?.length || 0}
          detail={adminAccess?.memberships?.[0]?.role?.name || 'Chưa được gán chức danh'}
          tone="green"
        />
        <AdminStatCard
          icon={<SafetyCertificateOutlined />}
          label="Phạm vi quyền"
          value={adminAccess?.isSuperuser ? 'Toàn quyền' : (adminAccess?.permissions?.length || 0)}
          detail={adminAccess?.isSuperuser ? 'Superuser hệ thống' : 'Quyền thao tác được cấp'}
          tone="amber"
        />
      </section>

      <AdminPanel
        title="Truy cập nhanh"
        description="Các công cụ được hiển thị dựa trên quyền đang hiệu lực của tài khoản."
      >
        {workspaceRoutes.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {workspaceRoutes.map((route) => (
              <Link key={route.path} to={route.path} className="admin-quick-link">
                <span className="admin-quick-link__icon" aria-hidden="true">
                  {ICONS[route.iconKey] || <AppstoreOutlined />}
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold">{route.navLabel}</span>
                  <span className="mt-0.5 block text-xs text-slate-500">{route.title}</span>
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
            Chưa có khu vực nghiệp vụ nào được cấp. Hãy liên hệ quản trị hệ thống để được gán phòng ban và quyền phù hợp.
          </div>
        )}
      </AdminPanel>
    </div>
  )
}
