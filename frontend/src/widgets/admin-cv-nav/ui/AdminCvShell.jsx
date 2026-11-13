import { ApartmentOutlined, BgColorsOutlined, DashboardOutlined, FileTextOutlined, SolutionOutlined } from '@ant-design/icons'
import { NavLink } from 'react-router'
import { useAdminAccess } from '@/entities/admin-access'
import { useSession } from '@/entities/session'
import { adminPath } from '@/shared/config/portals'
import { AdminPageHeader } from '@/shared/ui/admin'

// Mọi trang Mẫu CV dùng chung thanh điều hướng này để chuyển trang trong một chạm.
const ITEMS = [
  { to: '/cv/overview', label: 'Tổng quan', icon: <DashboardOutlined /> },
  { to: '/cv/templates', label: 'Mẫu CV', icon: <FileTextOutlined /> },
  { to: '/cv/positions', label: 'Nội dung theo vị trí', icon: <ApartmentOutlined /> },
  { to: '/cv/library', label: 'Thư viện', icon: <BgColorsOutlined /> },
  { to: '/cv/user-cvs', label: 'CV ứng viên', icon: <SolutionOutlined />, permission: 'cv_user.view' },
]

export function AdminCvNav() {
  const { user } = useSession()
  const access = useAdminAccess(user)
  return <nav aria-label="Các trang Mẫu CV" className="-mx-1 flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
    {ITEMS.filter((item) => !item.permission || access.has(item.permission)).map((item) => <NavLink key={item.to} to={adminPath(item.to)} className={({ isActive }) => `flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${isActive ? '!bg-emerald-50 !text-emerald-700' : '!text-slate-600 hover:!bg-slate-50 hover:!text-slate-900'}`}>
      {item.icon}{item.label}
    </NavLink>)}
  </nav>
}

// Khung trang: tiêu đề gọn + điều hướng chung. Trang chi tiết bỏ tiêu đề lớn (`compact`).
export default function AdminCvShell({ title, description, icon, actions, compact = false, children }) {
  return <div className="space-y-4">
    {!compact && <AdminPageHeader eyebrow="Mẫu CV" title={title} description={description} icon={icon} actions={actions} />}
    <AdminCvNav />
    {children}
  </div>
}
