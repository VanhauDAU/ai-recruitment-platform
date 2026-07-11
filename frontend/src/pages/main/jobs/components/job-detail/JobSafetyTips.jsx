import { SafetyCertificateOutlined } from '@ant-design/icons'

export default function JobSafetyTips() {
  return (
    <section className="rounded-2xl border border-amber-100 bg-amber-50/70 p-5 shadow-sm">
      <div className="flex items-center gap-2 text-slate-800">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-600"><SafetyCertificateOutlined /></span>
        <h2 className="text-base font-bold">Bí kíp tìm việc an toàn</h2>
      </div>
      <ul className="mt-4 space-y-2 text-xs leading-5 text-slate-600">
        <li>Không chuyển tiền hoặc đóng phí để được nhận việc.</li>
        <li>Không cung cấp mật khẩu, mã OTP hoặc thông tin thẻ ngân hàng.</li>
        <li>Kiểm tra kỹ thông tin công ty trước khi phỏng vấn.</li>
      </ul>
      <p className="mt-4 text-xs font-medium text-[var(--brand-primary)]">Luôn xác minh thông tin trước khi ứng tuyển.</p>
    </section>
  )
}
