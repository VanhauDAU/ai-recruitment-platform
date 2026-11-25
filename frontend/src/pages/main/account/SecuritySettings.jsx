import {
  CheckCircleFilled, ExclamationCircleFilled, KeyOutlined, MailOutlined, SafetyOutlined,
} from '@ant-design/icons'
import { Link } from 'react-router'
import { ACCOUNT_ROOT } from '@/entities/account/account'
import { useSession } from '@/entities/account/session'
import { SessionManager } from '@/features/common/account/session-management'
import { DataRequestsPanel } from '@/features/common/privacy/data-requests'
import { m } from '@/shared/config/i18n'

const CARD = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6'

function StatusTile({ icon, title, ok, status, action, to }) {
  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3.5 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-lg text-slate-500 shadow-sm">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="break-words text-sm font-semibold text-slate-800">{title}</p>
          <p className={`mt-0.5 flex items-start gap-1 text-xs font-medium leading-5 ${ok ? 'text-emerald-600' : 'text-amber-600'}`}>
            {ok ? <CheckCircleFilled aria-hidden className="mt-1" /> : <ExclamationCircleFilled aria-hidden className="mt-1" />}
            <span>{status}</span>
          </p>
        </div>
      </div>
      {action && (
        <Link
          to={to}
          className="ml-[52px] shrink-0 self-start rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold sm:ml-0 sm:self-auto !text-[var(--brand-primary)] transition hover:border-[var(--brand-primary)]"
        >
          {action}
        </Link>
      )}
    </div>
  )
}

// Trang "Cài đặt bảo mật" (ứng viên): tình trạng email/mật khẩu, thiết bị đang
// đăng nhập và quyền với dữ liệu cá nhân.
export default function SecuritySettings() {
  const { user } = useSession()
  const verified = Boolean(user?.email_verified)
  const hasPassword = Boolean(user?.has_usable_password)

  return (
    <div className="space-y-4">
      <section className={CARD}>
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-primary-soft)] text-xl text-[var(--brand-primary)]">
            <SafetyOutlined aria-hidden />
          </span>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-slate-900 sm:text-xl">{m.candidate_security_title()}</h1>
            <p className="mt-0.5 text-sm text-slate-500">{m.candidate_security_subtitle()}</p>
          </div>
        </div>
        <div className="mt-5 flex flex-col gap-3">
          <StatusTile
            icon={<MailOutlined aria-hidden />}
            title={user?.email || m.candidate_security_email()}
            ok={verified}
            status={verified ? m.candidate_security_email_verified() : m.candidate_security_email_unverified()}
            action={verified ? null : m.candidate_security_email_verify()}
            to={`${ACCOUNT_ROOT}/xac-thuc-email`}
          />
          <StatusTile
            icon={<KeyOutlined aria-hidden />}
            title={m.candidate_security_password()}
            ok={hasPassword}
            status={hasPassword ? m.candidate_security_password_set() : m.candidate_security_password_missing()}
            action={hasPassword ? m.candidate_security_password_change() : m.candidate_security_password_create()}
            to={`${ACCOUNT_ROOT}/doi-mat-khau`}
          />
        </div>
      </section>

      <section className={CARD}>
        <SessionManager />
      </section>

      <section className={CARD}>
        <DataRequestsPanel />
      </section>
    </div>
  )
}
