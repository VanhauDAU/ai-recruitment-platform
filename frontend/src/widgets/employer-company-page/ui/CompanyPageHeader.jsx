import { ExportOutlined } from '@ant-design/icons'
import { Alert } from 'antd'
import { Link } from 'react-router'
import { employerAppPath, MAIN_PORTAL_URL } from '@/shared/config/portals'

const ACTION_LINK = 'shrink-0 text-sm font-semibold !text-[var(--brand-primary)] hover:underline'
// Lý do bị chặn mà chính người dùng xử lý được: dẫn tới bước xác thực.
const VERIFY_BLOCKERS = new Set(['OWNER_NOT_VERIFIED', 'NOT_VERIFIED'])

/** `completeness` là thước đo độ hoàn thiện do workspace gắn vào. */
export default function CompanyPageHeader({ page, completeness }) {
  const { company, stats, permissions } = page
  const blocker = permissions.blockers?.[0]
  const totals = [
    [stats?.follower_count, 'người theo dõi'],
    [stats?.active_public_job_count, 'việc làm đang tuyển'],
  ]

  return (
    <>
      <header className="employer-company-page__header">
        <div className="min-w-0 flex-1">
          <h1 className="employer-company-page__title">Trang công ty</h1>
          <p className="employer-company-page__company">{company.display_name}</p>
        </div>
        <ul className="employer-company-page__stats" aria-label="Số liệu trang công ty">
          {totals.map(([value, label]) => (
            <li key={label}><strong>{(Number(value) || 0).toLocaleString('vi-VN')}</strong> {label}</li>
          ))}
        </ul>
        {company.is_public ? (
          <a
            href={`${MAIN_PORTAL_URL.replace(/\/$/, '')}${company.public_path}`}
            target="_blank"
            rel="noopener noreferrer"
            className={ACTION_LINK}
          >
            Xem trang công khai <ExportOutlined aria-hidden="true" />
          </a>
        ) : (
          <span className="employer-company-page__company">Trang chưa hiển thị công khai</span>
        )}
        {completeness && <div className="employer-company-page__completeness">{completeness}</div>}
      </header>
      {blocker && (
        <Alert
          showIcon
          type="warning"
          title={blocker.message}
          action={VERIFY_BLOCKERS.has(blocker.code) && (
            <Link to={employerAppPath('/employer-verify')} className={ACTION_LINK}>Xác thực tài khoản</Link>
          )}
        />
      )}
    </>
  )
}
