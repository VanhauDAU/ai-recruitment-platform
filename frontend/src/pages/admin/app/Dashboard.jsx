import {
  AppstoreOutlined,
  FileDoneOutlined,
  FileTextOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import { Link, useOutletContext } from 'react-router'
import {
  AdminPanel,
  AdminPageHeader,
  AdminStatCard,
} from '@/shared/ui/admin'

const ICONS = {
  cv: <FileTextOutlined />,
  dashboard: <AppstoreOutlined />,
  moderation: <FileDoneOutlined />,
  settings: <SettingOutlined />,
}

export default function AdminDashboard() {
  const { availableRoutes = [], adminAccess } = useOutletContext() || {}
  const workspaceRoutes = availableRoutes.filter((route) => route.segment !== '/dashboard')

  return (
    <div className="space-y-5">
      <AdminPageHeader
        eyebrow="Không gian quản trị"
        title="Bảng điều khiển"
        description="Tổng quan phạm vi truy cập và các công cụ quản trị được cấp cho tài khoản hiện tại."
        icon={<AppstoreOutlined />}
      />
      <section className="grid gap-4 md:grid-cols-2" aria-label="Tóm tắt quyền truy cập">
        <AdminStatCard
          icon={<AppstoreOutlined />}
          label="Khu vực khả dụng"
          value={availableRoutes.length}
          detail="Theo cấp quản trị hiện tại"
        />
        <AdminStatCard
          icon={<SafetyCertificateOutlined />}
          label="Cấp quản trị"
          value={adminAccess?.isSuperuser ? 'Superuser' : 'Quản trị viên'}
          detail={adminAccess?.isSuperuser
            ? 'Toàn quyền, gồm tài khoản quản trị và cài đặt hệ thống'
            : 'Mọi nghiệp vụ, trừ tài khoản quản trị và cài đặt hệ thống'}
          tone="amber"
        />
      </section>

      <AdminPanel
        title="Truy cập nhanh"
        description="Các công cụ được hiển thị theo cấp quản trị của tài khoản."
      >
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
      </AdminPanel>
    </div>
  )
}
