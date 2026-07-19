import { LogoutOutlined } from '@ant-design/icons'
import { Button, ConfigProvider } from 'antd'
import { Outlet } from 'react-router-dom'
import { useSession } from '@/entities/session'
import { BrandLogo } from '@/entities/site-settings'

export default function EmployerSetupLayout() {
  const { user, logout } = useSession()

  return (
    <ConfigProvider theme={{ token: { colorPrimary: '#00b14f', borderRadius: 8 } }}>
      <div className="min-h-dvh overflow-x-hidden bg-[#eef1f5] text-slate-900">
        <div className="bg-amber-500 px-4 py-2 text-center text-xs font-semibold text-amber-950 sm:text-sm">
          Bảo vệ dữ liệu ứng viên là trách nhiệm chung. Hãy hoàn thiện thông tin tài khoản trước khi bắt đầu tuyển dụng.
        </div>
        <header className="border-b border-white/10 bg-[#172b3d] text-white">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
            <BrandLogo dark className="max-w-[180px]" imageClassName="h-9 max-w-[170px]" textClassName="text-base" />
            {user && (
              <div className="flex items-center gap-3">
                <span className="hidden max-w-64 truncate text-sm text-white/70 sm:block">{user.full_name || user.email}</span>
                <Button type="text" onClick={logout} icon={<LogoutOutlined />} className="!text-white/80 hover:!bg-white/10 hover:!text-white">
                  <span className="hidden sm:inline">Đăng xuất</span>
                </Button>
              </div>
            )}
          </div>
        </header>
        <main className="px-3 py-5 sm:px-6 sm:py-8 lg:py-10">
          <Outlet />
        </main>
      </div>
    </ConfigProvider>
  )
}
