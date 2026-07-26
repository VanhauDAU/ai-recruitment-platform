import {
  AppstoreOutlined,
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
import {
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
  const { availableRoutes = [], adminAccess } = useOutletContext() || {}
  const workspaceRoutes = availableRoutes.filter((route) => route.segment !== '/dashboard')

  return (
    <div className="space-y-5">

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
