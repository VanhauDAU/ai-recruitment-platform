import { FileProtectOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import { useLocation } from 'react-router-dom'
import { useSiteSettings } from '@/entities/site-settings'

const termsSections = [
  ['1. Phạm vi dịch vụ', 'Cổng nhà tuyển dụng hỗ trợ tạo hồ sơ doanh nghiệp, đăng tin, quản lý ứng viên và sử dụng các công cụ tuyển dụng được công bố trên từng gói dịch vụ.'],
  ['2. Trách nhiệm tài khoản', 'Nhà tuyển dụng cung cấp thông tin chính xác, bảo mật thông tin đăng nhập và chịu trách nhiệm với hoạt động phát sinh từ tài khoản của mình.'],
  ['3. Nội dung tuyển dụng', 'Tin tuyển dụng phải hợp pháp, minh bạch về vị trí và không thu phí trái quy định từ ứng viên. Hệ thống có quyền tạm ẩn nội dung cần xác minh.'],
  ['4. Xác thực doanh nghiệp', 'Một số quyền có thể yêu cầu xác thực email, số điện thoại, tư cách thành viên công ty hoặc giấy tờ pháp lý của doanh nghiệp.'],
  ['5. Dữ liệu ứng viên', 'Nhà tuyển dụng chỉ sử dụng hồ sơ ứng viên cho mục đích tuyển dụng đã thông báo, không chia sẻ trái phép và phải tuân thủ thỏa thuận xử lý dữ liệu.'],
  ['6. Thay đổi và hỗ trợ', 'Điều khoản có thể được cập nhật cùng ngày hiệu lực rõ ràng. Các thay đổi quan trọng sẽ được thông báo trên tài khoản hoặc email đăng ký.'],
]

const privacySections = [
  ['1. Dữ liệu được thu thập', 'Chúng tôi xử lý thông tin tài khoản, người liên hệ, doanh nghiệp, lịch sử sử dụng dịch vụ, dữ liệu bảo mật và lựa chọn nhận tư vấn.'],
  ['2. Mục đích xử lý', 'Dữ liệu được dùng để tạo và bảo vệ tài khoản, cung cấp dịch vụ tuyển dụng, hỗ trợ khách hàng, ngăn gian lận và thực hiện nghĩa vụ pháp lý.'],
  ['3. Cơ sở và sự đồng ý', 'Điều khoản và chính sách quyền riêng tư là lựa chọn bắt buộc để cung cấp dịch vụ. Đồng ý nhận tư vấn là tùy chọn và có thể thay đổi sau.'],
  ['4. Chia sẻ và lưu trữ', 'Dữ liệu chỉ được chia sẻ với đơn vị xử lý cần thiết, cơ quan có thẩm quyền hoặc theo chỉ dẫn hợp lệ; thời gian lưu trữ phụ thuộc mục đích và yêu cầu pháp luật.'],
  ['5. Quyền của chủ thể dữ liệu', 'Bạn có thể yêu cầu truy cập, chỉnh sửa, hạn chế hoặc xóa dữ liệu trong phạm vi pháp luật cho phép và được thông báo về cách xử lý yêu cầu.'],
  ['6. An toàn thông tin', 'Chúng tôi áp dụng kiểm soát truy cập, xác thực và biện pháp kỹ thuật phù hợp; nhà tuyển dụng cũng cần chủ động bảo vệ thiết bị và thông tin đăng nhập.'],
]

export default function EmployerLegal() {
  const { pathname } = useLocation()
  const { siteName } = useSiteSettings()
  const isPrivacy = pathname.includes('chinh-sach-quyen-rieng')
  const title = isPrivacy ? 'Chính sách quyền riêng tư' : 'Điều khoản dịch vụ nhà tuyển dụng'
  const sections = isPrivacy ? privacySections : termsSections
  const Icon = isPrivacy ? FileProtectOutlined : SafetyCertificateOutlined

  return (
    <main className="bg-slate-50 py-12 sm:py-16">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <header className="rounded-3xl bg-[linear-gradient(135deg,#073e35,#06845f)] p-7 text-white shadow-xl shadow-emerald-950/10 sm:p-10">
          <Icon className="text-3xl text-emerald-200" />
          <h1 className="mt-4 text-3xl font-black sm:text-4xl">{title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70">Áp dụng cho tài khoản và dịch vụ tại cổng nhà tuyển dụng {siteName}.</p>
          <p className="mt-5 text-xs font-semibold uppercase tracking-widest text-emerald-200">Phiên bản 2026-07 · Hiệu lực từ 18/07/2026</p>
        </header>
        <article className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
          <p className="text-sm leading-7 text-slate-600">Văn bản này giải thích các nguyên tắc cốt lõi khi doanh nghiệp sử dụng nền tảng. Các hợp đồng hoặc phụ lục dịch vụ cụ thể, nếu có, sẽ được ưu tiên áp dụng cho phạm vi tương ứng.</p>
          <div className="mt-8 space-y-8">
            {sections.map(([heading, body]) => (
              <section key={heading}>
                <h2 className="text-lg font-black text-slate-900">{heading}</h2>
                <p className="mt-2 text-sm leading-7 text-slate-600">{body}</p>
              </section>
            ))}
          </div>
        </article>
      </div>
    </main>
  )
}
