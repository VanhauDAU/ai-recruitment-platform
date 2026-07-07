import {
  AppstoreOutlined, BankOutlined, BookOutlined, BulbOutlined, CalculatorOutlined,
  CompassOutlined, DollarOutlined, DownOutlined, EditOutlined, ExperimentOutlined,
  FileDoneOutlined, FileProtectOutlined, HighlightOutlined, IdcardOutlined, LikeOutlined,
  LineChartOutlined, MobileOutlined, OrderedListOutlined, ProfileOutlined, ReadOutlined,
  RiseOutlined, RocketOutlined, SafetyCertificateOutlined, SafetyOutlined, SearchOutlined,
  SnippetsOutlined, StarOutlined, UploadOutlined, WalletOutlined,
} from '@ant-design/icons'
import { App, Button, Tag } from 'antd'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

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
    to: '/jobs',
    columns: [
      [
        {
          title: 'Việc làm',
          items: [
            { label: 'Tìm việc làm', to: '/jobs', icon: <SearchOutlined /> },
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
  const { message } = App.useApp()
  const [openKey, setOpenKey] = useState(null)

  function handleItem(it) {
    setOpenKey(null)
    if (it.to) navigate(it.to)
    else if (it.search) navigate(`/jobs?search=${encodeURIComponent(it.search)}`)
    else message.info('Tính năng sẽ sớm ra mắt.')
  }

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
      <div className="w-full px-6 h-16 flex items-center gap-8">
        <Link to="/" className="flex items-center gap-1.5 whitespace-nowrap">
          <span className="text-xl font-extrabold text-[#00b14f]">AI Career</span>
          <span className="text-xl font-extrabold text-gray-800">Coach</span>
        </Link>

        <nav
          className="hidden md:flex items-stretch gap-6 text-sm font-medium text-gray-700 flex-1"
          onMouseLeave={() => setOpenKey(null)}
        >
          {NAV_MENUS.map((m) => (
            <div key={m.key} className="relative flex items-center" onMouseEnter={() => setOpenKey(m.key)}>
              <button
                onClick={() => (m.to ? navigate(m.to) : setOpenKey(m.key))}
                className={`flex items-center gap-1 h-16 transition ${openKey === m.key ? 'text-[#00b14f]' : 'hover:text-[#00b14f]'}`}
              >
                {m.label}
                <DownOutlined className={`text-[10px] transition-transform ${openKey === m.key ? 'rotate-180' : ''}`} />
              </button>

              {openKey === m.key && (
                <div className="absolute top-full left-0 bg-white rounded-xl border border-gray-100 shadow-xl p-5 flex gap-10 w-max max-w-[calc(100vw-3rem)] z-40">
                  {m.columns.map((col, ci) => (
                    <div key={ci} className="space-y-5">
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
                                className="flex items-start gap-2.5 py-1.5 text-sm text-gray-700 hover:text-[#00b14f] cursor-pointer text-left leading-snug max-w-[240px]"
                              >
                                {it.icon && <span className="text-[#00b14f] text-base leading-5 shrink-0">{it.icon}</span>}
                                <span>{it.label}</span>
                                {it.badge && <Tag color="green" className="!mr-0 !text-[10px] !leading-4 shrink-0">{it.badge}</Tag>}
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
          ))}
        </nav>

        <div className="flex items-center gap-2 ml-auto">
          {isAuthenticated ? (
            <>
              <Button onClick={() => navigate(DASHBOARD_BY_ROLE[user?.role] || '/')}>Trang quản lý</Button>
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
