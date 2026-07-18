import { MenuOutlined } from '@ant-design/icons'
import { Drawer } from 'antd'
import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { findActiveAccountItem } from '@/entities/account'
import { setDocumentTitle } from '@/shared/config/document-title'
import AccountSidebar from './ui/AccountSidebar'
import ProfileSidebar from './ui/ProfileSidebar'

/**
 * Layout 3 cột dùng chung cho cụm trang tài khoản ứng viên (/tai-khoan/...):
 * - Trái  (2/12): danh mục trang — accordion mở 1 nhóm/lần (AccountSidebar).
 * - Giữa  (7/12): nội dung từng trang qua <Outlet /> — mỗi trang một file riêng.
 * - Phải  (3/12): cụm thẻ hồ sơ/trạng thái tìm việc (ProfileSidebar).
 * Mobile: cột trái thu vào Drawer (nút "Danh mục"), cột phải dồn xuống dưới.
 * Route con + tiêu đề sinh từ public config của account — một nguồn duy nhất.
 */
export default function CandidateAccountLayout() {
  const { pathname } = useLocation()
  const [menuDrawerOpen, setMenuDrawerOpen] = useState(false)
  const activeItem = findActiveAccountItem(pathname)

  useEffect(() => {
    setDocumentTitle(activeItem ? activeItem.label : 'Quản lý tài khoản')
  }, [activeItem])

  return (
    <div className="min-h-full bg-[#f7f9fc]">
      <div className="mx-auto max-w-[1440px] px-3 py-4 sm:px-4 sm:py-6">
        {/* Nút mở danh mục — chỉ hiện trên mobile/tablet */}
        <button
          type="button"
          onClick={() => setMenuDrawerOpen(true)}
          className="mb-3 inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)] lg:hidden"
        >
          <MenuOutlined />
          {activeItem?.label || 'Danh mục tài khoản'}
        </button>

        <div className="lg:grid lg:grid-cols-12 lg:items-start lg:gap-5">
          <div className="hidden lg:sticky lg:top-20 lg:col-span-3 lg:block">
            <AccountSidebar />
          </div>

          <main className="min-w-0 lg:col-span-6">
            <Outlet />
          </main>

          <div className="mt-4 lg:sticky lg:top-20 lg:col-span-3 lg:mt-0 lg:max-h-[calc(100dvh-6rem)] lg:self-start lg:overflow-y-auto lg:[scrollbar-width:thin]">
            <ProfileSidebar />
          </div>
        </div>
      </div>

      <Drawer
        title="Danh mục tài khoản"
        placement="left"
        open={menuDrawerOpen}
        onClose={() => setMenuDrawerOpen(false)}
        size={320}
        styles={{ body: { padding: 12 } }}
      >
        <AccountSidebar onNavigate={() => setMenuDrawerOpen(false)} />
      </Drawer>
    </div>
  )
}
