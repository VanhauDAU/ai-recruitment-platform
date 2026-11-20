import { PauseCircleOutlined } from '@ant-design/icons'
import { Link } from 'react-router'
import { m } from '@/shared/config/i18n'

/** Admin đang tạm dừng đăng ký ở cổng này (SiteSetting *_allow_registration, ADR-0026). */
export default function RegistrationClosedNotice({ loginPath }) {
  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center" role="status">
      <PauseCircleOutlined className="text-3xl text-amber-600" aria-hidden="true" />
      <h2 className="mt-3 text-lg font-bold text-gray-900">{m.auth_registration_closed_title()}</h2>
      <p className="mt-2 text-sm leading-6 text-gray-600">{m.auth_registration_closed_text()}</p>
      <Link to={loginPath} className="mt-4 inline-block font-semibold text-[var(--brand-primary)] hover:underline">
        {m.auth_registration_closed_login()}
      </Link>
    </section>
  )
}
