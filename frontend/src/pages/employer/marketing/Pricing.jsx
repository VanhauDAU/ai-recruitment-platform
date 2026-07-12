import { CheckOutlined } from '@ant-design/icons'
import { Button } from 'antd'
import { Link } from 'react-router-dom'
import { employerAppPath } from '@/config/portals'

const PLANS = [
  {
    name: 'Starter',
    price: 'Miễn phí',
    desc: 'Phù hợp để thử quy trình đăng tin và nhận hồ sơ.',
    features: ['Tạo tài khoản nhà tuyển dụng', 'Quản lý hồ sơ công ty', 'Đăng tin ở mức cơ bản'],
    featured: false,
  },
  {
    name: 'Growth',
    price: 'Liên hệ',
    desc: 'Dành cho doanh nghiệp cần tuyển đều và muốn tăng độ phủ tin tuyển dụng.',
    features: ['Ưu tiên hiển thị tin', 'Quản lý nhiều vị trí', 'Báo cáo hiệu quả tuyển dụng'],
    featured: true,
  },
  {
    name: 'Enterprise',
    price: 'Theo nhu cầu',
    desc: 'Dành cho đội tuyển dụng có quy trình và khối lượng hồ sơ lớn.',
    features: ['Tư vấn triển khai', 'Phân quyền đội tuyển dụng', 'Tích hợp nghiệp vụ riêng'],
    featured: false,
  },
]

export default function EmployerPricing() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl text-center">
        <span className="rounded-full bg-[var(--brand-primary)]/10 px-4 py-1.5 text-sm font-bold text-[var(--brand-primary-hover)]">Báo giá</span>
        <h1 className="mt-5 text-4xl font-extrabold text-gray-950">Gói dịch vụ nhà tuyển dụng</h1>
        <p className="mt-4 text-lg leading-8 text-gray-600">
          Bảng giá hiện là khung placeholder để giữ đúng cấu trúc sản phẩm. Khi có nghiệp vụ thanh toán/gói dịch vụ, chỉ cần nối dữ liệu thật vào trang này.
        </p>
      </div>

      <div className="mt-10 grid gap-5 lg:grid-cols-3">
        {PLANS.map((plan) => (
          <article
            key={plan.name}
            className={`rounded-xl border p-6 shadow-sm ${
              plan.featured ? 'border-[var(--brand-primary)] bg-[#f4fff8]' : 'border-gray-100 bg-white'
            }`}
          >
            <h2 className="text-2xl font-bold">{plan.name}</h2>
            <p className="mt-3 min-h-14 leading-7 text-gray-600">{plan.desc}</p>
            <div className="mt-6 text-3xl font-extrabold text-gray-950">{plan.price}</div>
            <ul className="mt-6 space-y-3">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-center gap-3 text-sm font-medium text-gray-700">
                  <CheckOutlined className="text-[var(--brand-primary)]" />
                  {feature}
                </li>
              ))}
            </ul>
            <Link to={employerAppPath('/register')} className="mt-7 block">
              <Button type={plan.featured ? 'primary' : 'default'} shape="round" block>
                Bắt đầu
              </Button>
            </Link>
          </article>
        ))}
      </div>
    </section>
  )
}
