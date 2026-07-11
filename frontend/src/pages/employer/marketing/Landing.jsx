import { ArrowRightOutlined, CheckCircleFilled, TeamOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { Button } from 'antd'
import { Link } from 'react-router-dom'
import { employerAppPath, employerMarketingPath } from '@/config/portals'

const BENEFITS = [
  'Đăng tin tuyển dụng và quản lý hồ sơ tập trung',
  'Theo dõi trạng thái ứng tuyển theo từng vị trí',
  'Tối ưu hiển thị việc làm trên trang tìm kiếm ứng viên',
]

const STATS = [
  ['60.000+', 'việc làm mục tiêu'],
  ['34', 'tỉnh/thành dữ liệu địa điểm'],
  ['24/7', 'hồ sơ ứng viên online'],
]

export default function EmployerLanding() {
  return (
    <>
      <section className="bg-gradient-to-br from-[#eafff3] via-white to-[#f7fff9]">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-24">
          <div className="flex flex-col justify-center">
            <span className="mb-4 w-fit rounded-full bg-[var(--brand-primary)]/10 px-4 py-1.5 text-sm font-bold text-[var(--brand-primary-hover)]">
              ProCV for Employers
            </span>
            <h1 className="max-w-3xl text-4xl font-extrabold leading-tight text-gray-950 md:text-5xl">
              Tuyển đúng người, quản lý ứng viên gọn hơn
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-gray-600">
              Cổng nhà tuyển dụng riêng cho doanh nghiệp đăng tin, nhận hồ sơ và theo dõi pipeline ứng viên trong một nơi.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to={employerAppPath('/register')}>
                <Button type="primary" size="large" shape="round" className="!h-12 !px-7">
                  Đăng ký nhà tuyển dụng <ArrowRightOutlined />
                </Button>
              </Link>
              <Link to={employerMarketingPath('/bao-gia')}>
                <Button size="large" shape="round" className="!h-12 !px-7">
                  Xem báo giá
                </Button>
              </Link>
            </div>

            <div className="mt-8 space-y-3">
              {BENEFITS.map((item) => (
                <div key={item} className="flex items-center gap-3 text-sm font-medium text-gray-700">
                  <CheckCircleFilled className="text-[var(--brand-primary)]" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--brand-primary)]/15 bg-white p-5 shadow-[0_24px_80px_rgba(0,177,79,0.12)]">
            <div className="rounded-xl bg-gray-950 p-5 text-white">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <p className="text-sm text-white/60">Dashboard tuyển dụng</p>
                  <h2 className="text-xl font-bold">Tổng quan hôm nay</h2>
                </div>
                <span className="rounded-full bg-[var(--brand-primary)] px-3 py-1 text-xs font-bold">Live</span>
              </div>
              <div className="mt-5 grid gap-3">
                {[
                  ['Frontend Developer', '18 hồ sơ mới', 'Đang tuyển'],
                  ['Sales Executive', '11 hồ sơ mới', 'Ưu tiên'],
                  ['UI/UX Designer', '7 hồ sơ mới', 'Phỏng vấn'],
                ].map(([title, count, status]) => (
                  <div key={title} className="rounded-xl bg-white/8 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold">{title}</span>
                      <span className="rounded-full bg-white/10 px-3 py-1 text-xs">{status}</span>
                    </div>
                    <p className="mt-2 text-sm text-white/60">{count}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-4 px-4 py-10 sm:grid-cols-3 sm:px-6 lg:px-8">
        {STATS.map(([value, label]) => (
          <div key={label} className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="text-3xl font-extrabold text-[var(--brand-primary)]">{value}</div>
            <div className="mt-2 text-sm font-medium text-gray-500">{label}</div>
          </div>
        ))}
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-4 pb-16 sm:px-6 md:grid-cols-2 lg:px-8">
        <div className="rounded-xl bg-gray-50 p-7">
          <ThunderboltOutlined className="text-3xl text-[var(--brand-primary)]" />
          <h2 className="mt-4 text-2xl font-bold">Đăng tin nhanh</h2>
          <p className="mt-3 text-gray-600">Tạo tin tuyển dụng, chọn địa điểm, ngành nghề và yêu cầu kỹ năng theo dữ liệu chuẩn của hệ thống.</p>
        </div>
        <div className="rounded-xl bg-gray-50 p-7">
          <TeamOutlined className="text-3xl text-[var(--brand-primary)]" />
          <h2 className="mt-4 text-2xl font-bold">Quản lý ứng viên</h2>
          <p className="mt-3 text-gray-600">Theo dõi hồ sơ ứng tuyển theo từng job, cập nhật trạng thái và ghi chú cho nhà tuyển dụng.</p>
        </div>
      </section>
    </>
  )
}
