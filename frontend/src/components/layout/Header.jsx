import {
  AppstoreOutlined, BankOutlined, BookOutlined, BulbOutlined, CalculatorOutlined,
  CompassOutlined, DollarOutlined, DownOutlined, EditOutlined, ExperimentOutlined,
  FileDoneOutlined, FileProtectOutlined, HighlightOutlined, IdcardOutlined, LikeOutlined,
  LineChartOutlined, MobileOutlined, OrderedListOutlined, ProfileOutlined, ReadOutlined,
  RightOutlined, RiseOutlined, RocketOutlined, SafetyCertificateOutlined, SafetyOutlined,
  SearchOutlined, SnippetsOutlined, StarOutlined, UploadOutlined, WalletOutlined,
} from '@ant-design/icons'
import { MenuOutlined } from '@ant-design/icons'
import { App, Button, Drawer, Tag } from 'antd'
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import BrandLogo from '../brand/BrandLogo'
import CandidateUserMenu from './CandidateUserMenu'
import { EMPLOYER_PORTAL_URL, HOME_BY_ROLE } from '../../config/portals'
import { useAuth } from '../../hooks/useAuth'
import { useHideOnScroll } from '../../hooks/useHideOnScroll'

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
  const [mobileOpen, setMobileOpen] = useState(false)
  const [mobileKey, setMobileKey] = useState(null)
  const headerVisible = useHideOnScroll()
  const hideOnScroll =
    location.pathname === '/viec-lam'
    || location.pathname === '/jobs'
    || location.pathname.startsWith('/viec-lam/tai/')
  const shouldShowHeader = !hideOnScroll || headerVisible

  function isMenuActive(menu) {
    if (!menu.to) return false
    const paths = [menu.to, ...(menu.activePaths || [])]
    return paths.some((path) => location.pathname === path || location.pathname.startsWith(`${path}/`))
  }

  function handleItem(it) {
    setOpenKey(null)
    setMobileOpen(false)
    if (it.to) navigate(it.to)
    else if (it.search) navigate(`/viec-lam?search=${encodeURIComponent(it.search)}`)
    else message.info('Tính năng sẽ sớm ra mắt.')
  }

  // Gom item của 1 menu (columns -> groups -> items) thành danh sách phẳng cho drawer mobile.
  const flatItems = (menu) => menu.columns.flatMap((col) => col.flatMap((group) => group.items))

  return (
    <header
      className={`bg-white border-b border-gray-200 sticky top-0 z-30 transition-transform duration-300 ${
        shouldShowHeader ? 'translate-y-0' : '-translate-y-full'
      }`}
    >
      <div className="w-full px-4 sm:px-6 h-16 flex items-center gap-3 md:gap-8">
        <button
          type="button"
          aria-label="Mở menu"
          onClick={() => setMobileOpen(true)}
          className="md:hidden -ml-1 flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg text-xl text-gray-600 hover:bg-gray-100"
        >
          <MenuOutlined />
        </button>
        <BrandLogo variant="full" className="whitespace-nowrap cursor-pointer" imageClassName="h-8 sm:h-9 max-w-[150px] sm:max-w-[190px]" />

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
                      ? 'text-[var(--brand-primary)]'
                      : 'hover:text-[var(--brand-primary)]'
                  }`}
                >
                  {m.label}
                  <DownOutlined className={`text-[10px] transition-transform ${openKey === m.key ? 'rotate-180' : ''}`} />
                  <span
                    className={`absolute bottom-0 left-0 h-0.5 rounded-full bg-[var(--brand-primary)] transition-all duration-200 ${
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
                                  className="group flex items-center gap-2 py-1.5 text-sm text-gray-700 hover:text-[var(--brand-primary)] cursor-pointer text-left leading-snug"
                                >
                                  {it.icon && <span className="text-[var(--brand-primary)] text-base shrink-0">{it.icon}</span>}
                                  <span className="max-w-[220px]">{it.label}</span>
                                  {it.badge && <Tag color="green" className="!mr-0 !text-[10px] !leading-4 shrink-0">{it.badge}</Tag>}
                                  <RightOutlined className="text-[10px] text-[var(--brand-primary)] shrink-0 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
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

        <div className="flex items-center gap-4 ml-auto">
          {isAuthenticated && user?.role === 'candidate' ? (
            <>
              <CandidateUserMenu user={user} logout={logout} />
              <div className="hidden lg:block border-l border-gray-200 pl-4 leading-tight">
                <p className="text-xs text-gray-500">Bạn là nhà tuyển dụng?</p>
                <a href={EMPLOYER_PORTAL_URL} className="text-sm font-semibold text-[var(--brand-primary)] hover:underline">
                  Đăng tuyển ngay »
                </a>
              </div>
            </>
          ) : isAuthenticated ? (
            <>
              <Button className="cursor-pointer" onClick={() => navigate(HOME_BY_ROLE[user?.role] || '/')}>Trang quản lý</Button>
              <Button className="cursor-pointer" onClick={logout}>Đăng xuất</Button>
            </>
          ) : (
            <>
              <Link to="/sign-up" className="hidden sm:inline-block cursor-pointer"><Button className="cursor-pointer" shape="round">Đăng ký</Button></Link>
              <Link to="/login" className="cursor-pointer"><Button className="cursor-pointer" type="primary" shape="round">Đăng nhập</Button></Link>
              {/* Sang cổng NTD: thẻ <a> để hoạt động cả khi cổng là subdomain riêng */}
              <a href={EMPLOYER_PORTAL_URL} className="hidden lg:inline-block cursor-pointer">
                <Button className="cursor-pointer" ghost type="primary" shape="round">Đăng tuyển &amp; tìm hồ sơ</Button>
              </a>
            </>
          )}
        </div>
      </div>

      <Drawer
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        placement="left"
        size={300}
        styles={{ body: { padding: 0 } }}
        title={<BrandLogo variant="full" imageClassName="h-8 max-w-[160px]" />}
        className="md:hidden"
      >
        <nav className="flex flex-col py-1">
          {NAV_MENUS.map((m) => {
            const expanded = mobileKey === m.key
            return (
              <div key={m.key} className="border-b border-gray-100">
                <button
                  onClick={() => setMobileKey(expanded ? null : m.key)}
                  className="flex w-full cursor-pointer items-center justify-between px-5 py-3.5 text-left text-base font-semibold text-gray-800"
                >
                  {m.label}
                  <DownOutlined className={`text-xs text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                </button>
                <div className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                  <div className="overflow-hidden">
                    <div className="pb-2">
                      {flatItems(m).map((it) => (
                        <button
                          key={it.label}
                          onClick={() => handleItem(it)}
                          className="flex w-full cursor-pointer items-center gap-2 py-2 pl-8 pr-5 text-left text-sm text-gray-600 hover:text-[var(--brand-primary)]"
                        >
                          {it.icon && <span className="text-[var(--brand-primary)] shrink-0">{it.icon}</span>}
                          <span>{it.label}</span>
                          {it.badge && <Tag color="green" className="!mr-0 !text-[10px] !leading-4">{it.badge}</Tag>}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </nav>

        <div className="flex flex-col gap-2 p-5">
          {isAuthenticated ? (
            user?.role === 'candidate' ? (
              <a href={EMPLOYER_PORTAL_URL} className="text-center text-sm font-semibold text-[var(--brand-primary)]">
                Bạn là nhà tuyển dụng? Đăng tuyển ngay »
              </a>
            ) : (
              <Button block onClick={() => { setMobileOpen(false); navigate(HOME_BY_ROLE[user?.role] || '/') }}>Trang quản lý</Button>
            )
          ) : (
            <>
              <Link to="/login" onClick={() => setMobileOpen(false)}><Button block type="primary" shape="round">Đăng nhập</Button></Link>
              <Link to="/sign-up" onClick={() => setMobileOpen(false)}><Button block shape="round">Đăng ký</Button></Link>
              <a href={EMPLOYER_PORTAL_URL}><Button block ghost type="primary" shape="round">Đăng tuyển &amp; tìm hồ sơ</Button></a>
            </>
          )}
        </div>
      </Drawer>
    </header>
  )
}
