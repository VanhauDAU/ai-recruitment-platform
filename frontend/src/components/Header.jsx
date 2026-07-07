import { App, Button } from 'antd'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const DASHBOARD_BY_ROLE = {
  candidate: '/candidate/dashboard',
  employer: '/employer/dashboard',
  admin: '/admin/dashboard',
}

const NAV_ITEMS = [
  { label: 'Việc làm', to: '/jobs' },
  { label: 'Tạo CV', soon: true },
  { label: 'Công cụ', soon: true },
  { label: 'Cẩm nang nghề nghiệp', soon: true },
]

export default function Header() {
  const { user, isAuthenticated, logout } = useAuth()
  const navigate = useNavigate()
  const { message } = App.useApp()

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
      <div className="w-full px-6 h-16 flex items-center gap-8">
        <Link to="/" className="flex items-center gap-1.5 whitespace-nowrap">
          <span className="text-xl font-extrabold text-[#00b14f]">AI Career</span>
          <span className="text-xl font-extrabold text-gray-800">Coach</span>
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-700 flex-1">
          {NAV_ITEMS.map((item) =>
            item.soon ? (
              <button
                key={item.label}
                className="hover:text-[#00b14f] transition"
                onClick={() => message.info('Tính năng sẽ sớm ra mắt.')}
              >
                {item.label}
              </button>
            ) : (
              <Link key={item.label} to={item.to} className="hover:text-[#00b14f] transition">
                {item.label}
              </Link>
            ),
          )}
        </nav>

        <div className="flex items-center gap-2 ml-auto">
          {isAuthenticated ? (
            <>
              <Button onClick={() => navigate(DASHBOARD_BY_ROLE[user?.role] || '/')}>
                Trang quản lý
              </Button>
              <Button onClick={logout}>Đăng xuất</Button>
            </>
          ) : (
            <>
              <Link to="/register" className="hidden sm:inline-block"><Button>Đăng ký</Button></Link>
              <Link to="/login"><Button type="primary">Đăng nhập</Button></Link>
              <Link to="/register" className="hidden lg:inline-block">
                <Button ghost type="primary">Đăng tuyển &amp; tìm hồ sơ</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
