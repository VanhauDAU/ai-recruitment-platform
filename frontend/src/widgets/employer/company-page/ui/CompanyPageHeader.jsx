import { ExportOutlined } from '@ant-design/icons'
import { Alert } from 'antd'
import { Link } from 'react-router'
import { employerAppPath, MAIN_PORTAL_URL } from '@/shared/config/portals'
import { getIntlLocale, m } from '@/shared/config/i18n'

const ACTION_LINK = 'shrink-0 text-sm font-semibold !text-[var(--brand-primary)] hover:underline'
// Lý do bị chặn mà chính người dùng xử lý được: dẫn tới bước xác thực.
const VERIFY_BLOCKERS = new Set(['OWNER_NOT_VERIFIED', 'NOT_VERIFIED'])

/** `completeness` là thước đo độ hoàn thiện do workspace gắn vào. */
export default function CompanyPageHeader({ page, completeness }) {
  const { company, stats, permissions } = page
  const blocker = permissions.blockers?.[0]
  const totals = [
    [stats?.follower_count, m.employer_company_header_followers({ count: Number(stats?.follower_count) || 0 })],
    [stats?.active_public_job_count, m.employer_company_header_active_jobs({ count: Number(stats?.active_public_job_count) || 0 })],
  ]

  return (
    <>
      <header className="employer-company-page__header">
        <div className="min-w-0 flex-1">
          <h1 className="employer-company-page__title">{m.employer_company_header_title()}</h1>
          <p className="employer-company-page__company">{company.display_name}</p>
        </div>
        <ul className="employer-company-page__stats" aria-label={m.employer_company_header_stats_label()}>
          {totals.map(([value, label]) => (
            <li key={label}><strong>{(Number(value) || 0).toLocaleString(getIntlLocale())}</strong> {label}</li>
          ))}
        </ul>
        {company.is_public ? (
          <a
            href={`${MAIN_PORTAL_URL.replace(/\/$/, '')}${company.public_path}`}
            target="_blank"
            rel="noopener noreferrer"
            className={ACTION_LINK}
          >
            {m.employer_company_header_view_public()} <ExportOutlined aria-hidden="true" />
          </a>
        ) : (
          <span className="employer-company-page__company">{m.employer_company_header_not_public()}</span>
        )}
        {completeness && <div className="employer-company-page__completeness">{completeness}</div>}
      </header>
      {blocker && (
        <Alert
          showIcon
          type="warning"
          title={blocker.message}
          action={VERIFY_BLOCKERS.has(blocker.code) && (
            <Link to={employerAppPath('/employer-verify')} className={ACTION_LINK}>{m.employer_company_verify_account()}</Link>
          )}
        />
      )}
    </>
  )
}
