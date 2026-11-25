import { EyeOutlined, FileSyncOutlined } from '@ant-design/icons'
import { Tooltip } from 'antd'
import { recruiterVerificationMeta } from '@/entities/company/admin-company'
import { getIntlLocale, m } from '@/shared/config/i18n'
import CodeBadge from '@/shared/ui/code-badge/CodeBadge'
import CompanyLogo from './CompanyLogo'

// antd tag colors of recruiterVerificationMeta → `.ws-tone-*` dots.
const TONES = { gold: 'amber', blue: 'sky', orange: 'orange', red: 'red', green: 'emerald' }
const count = (value) => (Number(value) || 0).toLocaleString(getIntlLocale())

const formatDate = (value) => new Intl.DateTimeFormat(getIntlLocale(), { dateStyle: 'short' }).format(new Date(value))
const formatTime = (value) => new Intl.DateTimeFormat(getIntlLocale(), { timeStyle: 'short' }).format(new Date(value))

// On a narrow table each stat carries its own label; a wide one has a header.
function Stat({ label, children }) {
  return (
    <div className="wt-cell">
      <span className="wt-label">{label}</span>
      {children}
    </div>
  )
}

export default function AdminCompanyListRow({ company, onOpen, onOpenUpdates }) {
  const owners = company.owners || []
  const owner = owners[0]
  const pending = Number(company.pending_update_count) || 0
  const verification = Object.entries(company.recruiter_verification_summary || {}).filter(([, value]) => value > 0)

  return (
    <article data-testid={`admin-company-row-${company.public_id}`} className="wt-row">
      <div className="wt-cell wt-cell--main">
        <div className="acl-identity">
          <CompanyLogo company={company} size={40} />
          <span className="acl-identity__text">
            <button type="button" className="wt-title acl-open" onClick={() => onOpen(company)}>{company.company_name}</button>
            <span className="wt-meta">
              <CodeBadge code={company.code} />
              {company.tax_code && <span>{m.admin_company_list_tax_code({ code: company.tax_code })}</span>}
              {company.business_type_label && <span>{company.business_type_label}</span>}
            </span>
            {company.trade_name && company.trade_name !== company.company_name && (
              <span className="wt-meta"><span className="ws-muted">{company.trade_name}</span></span>
            )}
          </span>
        </div>
      </div>
      <Stat label={m.admin_company_list_col_owner()}>
        <span className="ws-strong ws-strong--sm acl-truncate">
          {owner?.full_name || owner?.email || <span className="ws-muted">{m.admin_company_list_no_owner()}</span>}
        </span>
        <span className="ws-caption ws-muted">
          {m.admin_company_list_roles({ owners: count(company.owner_count), members: count(company.member_count) })}
        </span>
        {owners.length > 1 && (
          <Tooltip title={owners.slice(1).map((item) => item.full_name || item.email).join(', ')}>
            <span className="ws-caption ws-muted acl-more" tabIndex={0}>
              {m.admin_company_list_more_owners({ count: owners.length - 1 })}
            </span>
          </Tooltip>
        )}
        {company.owner_count !== 1 && (
          <span className="ws-pill ws-tone-amber">{m.admin_company_list_owner_review()}</span>
        )}
      </Stat>
      <Stat label={m.admin_company_list_col_recruiters()}>
        <strong className="ws-strong">{m.admin_company_list_recruiter_count({ count: count(company.recruiter_count) })}</strong>
        {verification.length ? (
          <span className="acl-pills">
            {verification.map(([status, value]) => {
              const meta = recruiterVerificationMeta(status)
              return <span key={status} className={`ws-pill ws-tone-${TONES[meta.color] || 'slate'}`}>{meta.label} · {value}</span>
            })}
          </span>
        ) : (
          <span className="ws-caption ws-muted">{m.admin_company_list_no_recruiters()}</span>
        )}
      </Stat>
      <Stat label={m.admin_company_list_col_updates()}>
        {pending
          ? <strong className="ws-strong ws-strong--sm acl-alert">{m.admin_company_list_pending_updates({ count: count(pending) })}</strong>
          : <span className="ws-caption ws-muted">{m.admin_company_list_no_updates()}</span>}
      </Stat>
      <Stat label={m.admin_company_list_col_updated()}>
        {company.updated_at ? (
          <>
            <span className="ws-strong ws-strong--sm">{formatDate(company.updated_at)}</span>
            <span className="ws-caption ws-muted">{formatTime(company.updated_at)}</span>
          </>
        ) : <span className="ws-caption ws-muted">{m.admin_company_list_not_updated()}</span>}
      </Stat>
      <div className="wt-cell wt-cell--actions">
        <div className="wt-actions">
          <button type="button" className="wt-btn wt-btn--primary" onClick={() => onOpen(company)}>
            <EyeOutlined aria-hidden /><span>{m.admin_company_list_view_detail()}</span>
          </button>
          {pending > 0 && (
            <button type="button" className="wt-btn" onClick={() => onOpenUpdates(company)}>
              <FileSyncOutlined aria-hidden /><span>{m.admin_company_list_open_updates()}</span>
            </button>
          )}
        </div>
      </div>
    </article>
  )
}
