import { ChangePasswordForm } from '@/features/change-password'

export default function ChangePassword() {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <header className="mb-5">
        <h1 className="text-lg font-bold text-slate-900 sm:text-xl">Đổi mật khẩu</h1>
        <p className="mt-1 text-sm leading-6 text-slate-500">
          Sử dụng mật khẩu riêng và không chia sẻ với người khác để bảo vệ tài khoản của bạn.
        </p>
      </header>

      <ChangePasswordForm showEmail reauthPath="/login" />
    </section>
  )
}
