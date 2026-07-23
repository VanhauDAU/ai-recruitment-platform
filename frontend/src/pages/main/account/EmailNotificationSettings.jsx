import { EmailNotificationSettingsForm } from '@/features/configure-email-notifications'

export default function EmailNotificationSettings() {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="border-b border-slate-200 px-5 py-5 sm:px-6">
        <h1 className="text-lg font-bold text-slate-900 sm:text-xl">Cài đặt thông báo qua email</h1>
        <p className="mt-1 text-sm leading-6 text-slate-500">
          Chọn những email bạn muốn nhận. Thay đổi được lưu tự động.
        </p>
      </header>
      <EmailNotificationSettingsForm />
    </section>
  )
}
