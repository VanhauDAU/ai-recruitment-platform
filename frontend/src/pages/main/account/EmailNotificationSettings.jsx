import { EmailNotificationSettingsForm } from '@/features/main/account/configure-email-notifications'

export default function EmailNotificationSettings() {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="border-b border-slate-200 px-5 py-5 sm:px-6">
        <h1 className="text-lg font-bold text-slate-900 sm:text-xl">Cài đặt nhận thông báo</h1>
      </header>
      <EmailNotificationSettingsForm />
    </section>
  )
}
