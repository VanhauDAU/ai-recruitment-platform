import {
  AppstoreOutlined, BankOutlined, BookOutlined, BulbOutlined, CalculatorOutlined,
  CompassOutlined, DollarOutlined, EditOutlined, ExperimentOutlined, FileDoneOutlined,
  FileProtectOutlined, HighlightOutlined, IdcardOutlined, LikeOutlined, LineChartOutlined,
  MobileOutlined, OrderedListOutlined, ProfileOutlined, ReadOutlined, RiseOutlined,
  RocketOutlined, SafetyCertificateOutlined, SafetyOutlined, SearchOutlined,
  SnippetsOutlined, StarOutlined, UploadOutlined, WalletOutlined,
} from '@ant-design/icons'

const job = (name) => ({ label: `Việc làm ${name}`, search: name })
const soon = (label, icon, badge) => ({ label, icon, badge })

export const HEADER_NAVIGATION = [
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
            { label: 'Việc làm đã lưu', icon: <BookOutlined />, action: 'saved-jobs' },
            soon('Việc làm đã ứng tuyển', <FileDoneOutlined />),
            soon('Việc làm phù hợp', <LikeOutlined />),
          ],
        },
        { title: 'Công ty', items: [soon('Danh sách công ty', <BankOutlined />)] },
      ],
      [{
        title: 'Việc làm theo vị trí',
        cols: 2,
        items: [
          'Nhân viên kinh doanh', 'Kế toán', 'Marketing', 'Hành chính nhân sự',
          'Chăm sóc khách hàng', 'Ngân hàng', 'IT', 'Lao động phổ thông',
          'Senior', 'Kỹ sư xây dựng', 'Thiết kế đồ hoạ', 'Bất động sản',
          'Giáo dục', 'Telesales',
        ].map(job),
      }],
      [{
        title: 'Việc làm theo lĩnh vực',
        items: [
          'Sản xuất', 'Bán lẻ - Hàng tiêu dùng - FMCG', 'IT - Phần mềm',
          'Xây dựng', 'Giáo dục/Đào tạo',
        ].map(job),
      }],
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
          items: [
            'Nhân viên kinh doanh', 'Lập trình viên', 'Nhân viên kế toán',
            'Chuyên viên marketing',
          ].map((label) => soon(label, <IdcardOutlined />)),
        },
      ],
      [{
        items: [
          soon('Quản lý CV', <ProfileOutlined />),
          soon('Tải CV lên', <UploadOutlined />),
          soon('Hướng dẫn viết CV', <EditOutlined />),
          soon('Quản lý Cover Letter', <FileProtectOutlined />),
          soon('Mẫu Cover Letter', <SnippetsOutlined />),
        ],
      }],
    ],
  },
  {
    key: 'tools',
    label: 'Công cụ',
    columns: [
      [{
        title: 'Khám phá và nâng cấp bản thân',
        items: [
          soon('Bộ câu hỏi phỏng vấn', <ReadOutlined />, 'Mới'),
          soon('Trắc nghiệm MBTI', <BulbOutlined />),
          soon('Trắc nghiệm MI', <ExperimentOutlined />),
          soon('Bộ kỹ năng', <OrderedListOutlined />),
          soon('Khóa học', <ReadOutlined />),
        ],
      }],
      [{
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
      }],
    ],
  },
  {
    key: 'handbook',
    label: 'Cẩm nang nghề nghiệp',
    to: '/blog',
    columns: [
      [{
        items: [
          { label: 'Định hướng nghề nghiệp', to: '/blog/danh-muc/dinh-huong-nghe-nghiep', icon: <CompassOutlined /> },
          { label: 'Bí kíp tìm việc', to: '/blog/danh-muc/bi-kip-tim-viec', icon: <BulbOutlined /> },
          { label: 'Chế độ lương thưởng', to: '/blog/danh-muc/che-do-luong-thuong', icon: <DollarOutlined /> },
          { label: 'Kiến thức chuyên ngành', to: '/blog/danh-muc/kien-thuc-chuyen-nganh', icon: <ReadOutlined /> },
          { label: 'Hành trang nghề nghiệp', to: '/blog/danh-muc/hanh-trang-nghe-nghiep', icon: <RocketOutlined /> },
          { label: 'Thị trường & xu hướng tuyển dụng', to: '/blog/danh-muc/thi-truong-xu-huong-tuyen-dung', icon: <LineChartOutlined /> },
        ],
      }],
      [{
        title: 'Cẩm nang',
        items: [
          { label: 'Tất cả bài viết', to: '/blog', icon: <ReadOutlined /> },
        ],
      }],
    ],
  },
]

export function flattenMenuItems(menu) {
  return menu.columns.flatMap((column) => column.flatMap((group) => group.items))
}

export function isMenuActive(menu, pathname) {
  if (!menu.to) return false
  return [menu.to, ...(menu.activePaths || [])].some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  )
}
