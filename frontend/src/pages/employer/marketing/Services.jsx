import { CheckCircleFilled } from '@ant-design/icons'
import { Button } from 'antd'
import { Link } from 'react-router-dom'
import { employerAppPath, employerMarketingPath } from '@/config/portals'

const SERVICES = [
  {
    title: 'Đăng tin tuyển dụng',
    desc: 'Tạo và quản lý tin tuyển dụng theo ngành nghề, địa điểm, kỹ năng và cấp bậc.',
  },
  {
    title: 'Quản lý hồ sơ ứng tuyển',
    desc: 'Xem danh sách ứng viên theo từng job, cập nhật trạng thái và ghi chú tuyển dụng.',
  },
  {
    title: 'Hiển thị thương hiệu tuyển dụng',
    desc: 'Tối ưu thông tin công ty, logo, cover và các thông tin giúp ứng viên tin tưởng hơn.',
  },
]

export default function EmployerServices() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="max-w-3xl">
        <span className="rounded-full bg-[var(--brand-primary)]/10 px-4 py-1.5 text-sm font-bold text-[var(--brand-primary-hover)]">Dịch vụ</span>
        <h1 className="mt-5 text-4xl font-extrabold text-gray-950">Bộ công cụ tuyển dụng cho doanh nghiệp</h1>
        <p className="mt-4 text-lg leading-8 text-gray-600">
          Bắt đầu từ những nghiệp vụ cốt lõi: đăng tin, nhận hồ sơ và quản lý trạng thái ứng viên. Các gói nâng cao có thể mở rộng sau mà không đổi lại cấu trúc cổng.
        </p>
      </div>

      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {SERVICES.map((service) => (
          <article key={service.title} className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
            <CheckCircleFilled className="text-2xl text-[var(--brand-primary)]" />
            <h2 className="mt-5 text-xl font-bold">{service.title}</h2>
            <p className="mt-3 leading-7 text-gray-600">{service.desc}</p>
          </article>
        ))}
      </div>

      <div className="mt-10 flex flex-col gap-3 rounded-xl bg-gray-50 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold">Sẵn sàng thử cổng nhà tuyển dụng?</h2>
          <p className="mt-1 text-gray-600">Tạo tài khoản để bắt đầu quản lý tin tuyển dụng.</p>
        </div>
        <div className="flex gap-3">
          <Link to={employerMarketingPath('/bao-gia')}>
            <Button shape="round">Xem báo giá</Button>
          </Link>
          <Link to={employerAppPath('/register')}>
            <Button type="primary" shape="round">Đăng ký</Button>
          </Link>
        </div>
      </div>
    </section>
  )
}
