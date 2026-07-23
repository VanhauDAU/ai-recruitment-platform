import { MailOutlined } from '@ant-design/icons'
import { EmailNotificationSettingsForm } from '@/features/configure-email-notifications'

export default function EmailNotificationSettings() {
  return (
    <section className="space-y-4">
      <header className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm sm:px-6 sm:py-6">
        <div className="absolute -right-16 -top-20 h-48 w-48 rounded-full bg-emerald-50" />
        <div className="absolute -bottom-20 right-20 h-36 w-36 rounded-full bg-sky-50" />
        <div className="relative flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--brand-primary)] text-lg text-white shadow-[0_8px_20px_rgba(0,177,79,0.2)]">
            <MailOutlined />
          </span>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-slate-900 sm:text-xl">Cài đặt thông báo qua email</h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
              Chọn những nội dung hữu ích bạn muốn nhận. Mỗi thay đổi được lưu tự động
              và bạn có thể điều chỉnh lại bất cứ lúc nào.
            </p>
          </div>
        </div>
      </header>

      <EmailNotificationSettingsForm />
    </section>
  )
}
