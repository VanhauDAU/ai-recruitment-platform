import { ApartmentOutlined, BgColorsOutlined, DashboardOutlined, FileTextOutlined, SolutionOutlined } from '@ant-design/icons'
import { NavLink } from 'react-router'
import { adminPath } from '@/shared/config/portals'

// Mọi trang Mẫu CV dùng chung thanh điều hướng này để chuyển trang trong một chạm.
const ITEMS = [
  { to: '/cv/overview', label: 'Tổng quan', icon: <DashboardOutlined /> },
  { to: '/cv/templates', label: 'Mẫu CV', icon: <FileTextOutlined /> },
  { to: '/cv/positions', label: 'Nội dung theo vị trí', icon: <ApartmentOutlined /> },
  { to: '/cv/library', label: 'Thư viện', icon: <BgColorsOutlined /> },
  { to: '/cv/user-cvs', label: 'CV ứng viên', icon: <SolutionOutlined /> },
]

export function AdminCvNav() {
  return <nav aria-label="Các trang Mẫu CV" className="-mx-1 flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
    {ITEMS.map((item) => <NavLink key={item.to} to={adminPath(item.to)} className={({ isActive }) => `flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${isActive ? '!bg-[var(--brand-primary-soft)] !text-[var(--brand-primary-hover)]' : '!text-slate-600 hover:!bg-slate-50 hover:!text-slate-900'}`}>
      {item.icon}{item.label}
    </NavLink>)}
  </nav>
}

// Khung trang: điều hướng chung, kèm nút thao tác của trang (nếu có) bên phải.
export default function AdminCvShell({ actions, children }) {
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <AdminCvNav />
      {actions}
    </div>
    {children}
  </div>
}
