import {
  AppstoreOutlined, BankOutlined, BookOutlined, BulbOutlined, CalculatorOutlined,
  CompassOutlined, DollarOutlined, DownOutlined, EditOutlined, ExperimentOutlined,
  FileDoneOutlined, FileProtectOutlined, HighlightOutlined, IdcardOutlined, LikeOutlined,
  LineChartOutlined, MobileOutlined, OrderedListOutlined, ProfileOutlined, ReadOutlined,
  RightOutlined, RiseOutlined, RocketOutlined, SafetyCertificateOutlined, SafetyOutlined,
  SearchOutlined, SnippetsOutlined, StarOutlined, UploadOutlined, WalletOutlined,
} from '@ant-design/icons'
import { App, Button, Tag } from 'antd'
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useHideOnScroll } from '../../hooks/useHideOnScroll'

const DASHBOARD_BY_ROLE = {
  candidate: '/candidate/dashboard',
  employer: '/employer/dashboard',
  admin: '/admin/dashboard',
}

// helpers to keep the menu data compact
const job = (name) => ({ label: `Việc làm ${name}`, search: name })
const soon = (label, icon, badge) => ({ label, icon, badge })

// Each nav item -> array of columns; each column -> array of groups { title?, items, cols? }.
const NAV_MENUS = [
  {
    key: 'jobs',
    label: 'Việc làm',
    to: '/viec-lam',
    activePaths: ['/jobs'],
    columns: [
      [
        {
          title: 'Việc làm',
          items: [
            { label: 'Tìm việc làm', to: '/viec-lam', icon: <SearchOutlined /> },
            soon('Việc làm đã lưu', <BookOutlined />),
            soon('Việc làm đã ứng tuyển', <FileDoneOutlined />),
            soon('Việc làm phù hợp', <LikeOutlined />),
          ],
        },
        { title: 'Công ty', items: [soon('Danh sách công ty', <BankOutlined />)] },
      ],
      [
        {
          title: 'Việc làm theo vị trí',
          cols: 2,
          items: [
            'Nhân viên kinh doanh', 'Kế toán', 'Marketing', 'Hành chính nhân sự',
            'Chăm sóc khách hàng', 'Ngân hàng', 'IT', 'Lao động phổ thông',
            'Senior', 'Kỹ sư xây dựng', 'Thiết kế đồ hoạ', 'Bất động sản',
            'Giáo dục', 'Telesales',
          ].map(job),
        },
      ],
      [
        {
          title: 'Việc làm theo lĩnh vực',
          items: ['Sản xuất', 'Bán lẻ - Hàng tiêu dùng - FMCG', 'IT - Phần mềm', 'Xây dựng', 'Giáo dục/Đào tạo'].map(job),
        },
      ],
    ],
  },
  {
    key: 'cv',
    label: 'Tạo CV',
    columns: [
      [
        {
          title: 'Mẫu CV theo style',
          items: [
            soon('Mẫu CV Đơn giản', <AppstoreOutlined />),
            soon('Mẫu CV Ấn tượng', <CompassOutlined />),
            soon('Mẫu CV Chuyên nghiệp', <StarOutlined />),
            soon('Mẫu CV Harvard', <HighlightOutlined />),
          ],
        },
        {
          title: 'Mẫu CV theo vị trí ứng tuyển',
          items: ['Nhân viên kinh doanh', 'Lập trình viên', 'Nhân viên kế toán', 'Chuyên viên marketing'].map((l) => soon(l, <IdcardOutlined />)),
        },
      ],
      [
        {
          items: [
            soon('Quản lý CV', <ProfileOutlined />),
            soon('Tải CV lên', <UploadOutlined />),
            soon('Hướng dẫn viết CV', <EditOutlined />),
            soon('Quản lý Cover Letter', <FileProtectOutlined />),
            soon('Mẫu Cover Letter', <SnippetsOutlined />),
          ],
        },
      ],
    ],
  },
  {
    key: 'tools',
    label: 'Công cụ',
    columns: [
      [
        {
          title: 'Khám phá và nâng cấp bản thân',
          items: [
            soon('Bộ câu hỏi phỏng vấn', <ReadOutlined />, 'Mới'),
            soon('Trắc nghiệm MBTI', <BulbOutlined />),
            soon('Trắc nghiệm MI', <ExperimentOutlined />),
            soon('Bộ kỹ năng', <OrderedListOutlined />),
            soon('Khóa học', <ReadOutlined />),
          ],
        },
      ],
      [
        {
          title: 'Công cụ',
          cols: 2,
          items: [
            soon('Tính lương Gross - Net', <DollarOutlined />),
            soon('Tính thuế thu nhập cá nhân', <CalculatorOutlined />),
            soon('Tra cứu lương', <LineChartOutlined />, 'Mới'),
            soon('Tính lãi suất kép', <RiseOutlined />),
            soon('Tính bảo hiểm thất nghiệp', <SafetyOutlined />),
            soon('Tính bảo hiểm xã hội một lần', <SafetyCertificateOutlined />),
            soon('Lập kế hoạch tiết kiệm', <WalletOutlined />),
            soon('Ứng dụng di động', <MobileOutlined />),
          ],
        },
      ],
    ],
  },
  {
    key: 'handbook',
    label: 'Cẩm nang nghề nghiệp',
    columns: [
      [
        {
          items: [
            soon('Định hướng nghề nghiệp', <CompassOutlined />),
            soon('Bí kíp tìm việc', <BulbOutlined />),
            soon('Chế độ lương thưởng', <DollarOutlined />),
            soon('Kiến thức chuyên ngành', <ReadOutlined />),
            soon('Hành trang nghề nghiệp', <RocketOutlined />),
            soon('Thị trường & xu hướng tuyển dụng', <LineChartOutlined />),
          ],
        },
      ],
      [
        {
          title: 'Bài viết nổi bật',
          items: [soon('Lương Net là gì? Quy đổi Net sang Gross'), soon('Tải miễn phí các mẫu đơn xin nghỉ phép chuẩn'), soon('Xem thêm bài viết nổi bật →')],
        },
      ],
    ],
  },
]

export default function Header() {
  const { user, isAuthenticated, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { message } = App.useApp()
  const [openKey, setOpenKey] = useState(null)
  const headerVisible = useHideOnScroll()

  function isMenuActive(menu) {
    if (!menu.to) return false
    const paths = [menu.to, ...(menu.activePaths || [])]
    return paths.some((path) => location.pathname === path || location.pathname.startsWith(`${path}/`))
  }

  function handleItem(it) {
    setOpenKey(null)
    if (it.to) navigate(it.to)
    else if (it.search) navigate(`/viec-lam?search=${encodeURIComponent(it.search)}`)
    else message.info('Tính năng sẽ sớm ra mắt.')
  }

  return (
    <header
      className={`bg-white border-b border-gray-200 sticky top-0 z-30 transition-transform duration-300 ${
        headerVisible ? 'translate-y-0' : '-translate-y-full'
      }`}
    >
      <div className="w-full px-6 h-16 flex items-center gap-8">
        <Link to="/" className="flex items-center gap-1.5 whitespace-nowrap cursor-pointer">
          <span className="text-xl font-extrabold text-[#00b14f]">AI Career</span>
          <span className="text-xl font-extrabold text-gray-800">Coach</span>
        </Link>

        <nav
          className="hidden md:flex items-stretch gap-6 text-sm font-medium text-gray-700 flex-1"
          onMouseLeave={() => setOpenKey(null)}
        >
          {NAV_MENUS.map((m) => {
            const active = isMenuActive(m)
            return (
              <div key={m.key} className="relative flex items-center" onMouseEnter={() => setOpenKey(m.key)}>
                <button
                  onClick={() => (m.to ? navigate(m.to) : setOpenKey(m.key))}
                  aria-current={active ? 'page' : undefined}
                  className={`relative flex h-16 cursor-pointer items-center gap-1 px-1 transition ${
                    active || openKey === m.key
                      ? 'text-[#00b14f]'
                      : 'hover:text-[#00b14f]'
                  }`}
                >
                  {m.label}
                  <DownOutlined className={`text-[10px] transition-transform ${openKey === m.key ? 'rotate-180' : ''}`} />
                  <span
                    className={`absolute bottom-0 left-0 h-0.5 rounded-full bg-[#00b14f] transition-all duration-200 ${
                      active ? 'w-full opacity-100' : 'w-0 opacity-0'
                    }`}
                  />
                </button>

                {openKey === m.key && (
                  <div className="absolute top-full left-0 bg-white rounded-xl border border-gray-100 shadow-xl py-4 flex divide-x divide-gray-100 w-max max-w-[calc(100vw-3rem)] z-40">
                    {m.columns.map((col, ci) => (
                      <div key={ci} className="px-6 space-y-5">
                        {col.map((g, gi) => (
                          <div key={gi}>
                            {g.title && (
                              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{g.title}</p>
                            )}
                            <div className={g.cols === 2 ? 'grid grid-cols-2 gap-x-8' : ''}>
                              {g.items.map((it) => (
                                <button
                                  key={it.label}
                                  onClick={() => handleItem(it)}
                                  className="group flex items-center gap-2 py-1.5 text-sm text-gray-700 hover:text-[#00b14f] cursor-pointer text-left leading-snug"
                                >
                                  {it.icon && <span className="text-[#00b14f] text-base shrink-0">{it.icon}</span>}
                                  <span className="max-w-[220px]">{it.label}</span>
                                  {it.badge && <Tag color="green" className="!mr-0 !text-[10px] !leading-4 shrink-0">{it.badge}</Tag>}
                                  <RightOutlined className="text-[10px] text-[#00b14f] shrink-0 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        <div className="flex items-center gap-2 ml-auto">
          {isAuthenticated ? (
            <>
              <Button className="cursor-pointer" onClick={() => navigate(DASHBOARD_BY_ROLE[user?.role] || '/')}>Trang quản lý</Button>
              <Button className="cursor-pointer" onClick={logout}>Đăng xuất</Button>
            </>
          ) : (
            <>
              <Link to="/sign-up" className="hidden sm:inline-block cursor-pointer"><Button className="cursor-pointer" shape="round">Đăng ký</Button></Link>
              <Link to="/login" className="cursor-pointer"><Button className="cursor-pointer" type="primary" shape="round">Đăng nhập</Button></Link>
              <Link to="/sign-up" className="hidden lg:inline-block cursor-pointer">
                <Button className="cursor-pointer" ghost type="primary" shape="round">Đăng tuyển &amp; tìm hồ sơ</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
