import { startOAuthReauth } from '@/features/auth'
import { ChangePasswordForm } from '@/features/change-password'

export default function ChangePassword() {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h1 className="text-lg font-bold text-slate-900 sm:text-xl">Đổi mật khẩu</h1>
      <div className="mt-5 max-w-xl">
        <ChangePasswordForm showEmail onReauth={startOAuthReauth} />
      </div>
    </section>
  )
}



