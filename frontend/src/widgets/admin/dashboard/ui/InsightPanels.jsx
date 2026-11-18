import {
  ApartmentOutlined,
  ExclamationCircleFilled,
  RightOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Link } from 'react-router'
import { AdminPanel } from '@/shared/ui/admin'
import {
  DASHBOARD_LINKS,
  formatCompact,
  formatNumber,
  formatPercent,
  ratio,
} from '../model/dashboard-model'

const FUNNEL_STAGES = [
  { key: 'submitted', label: 'Nộp hồ sơ' },
  { key: 'viewed', label: 'NTD đã xem' },
  { key: 'shortlisted', label: 'Phù hợp' },
  { key: 'interviewed', label: 'Phỏng vấn' },
  { key: 'accepted', label: 'Trúng tuyển' },
]

const JOB_STATES = [
  { key: 'active', label: 'Đang tuyển' },
  { key: 'hidden', label: 'Bị ẩn' },
  { key: 'expired', label: 'Hết hạn' },
  { key: 'closed', label: 'Ngừng tuyển' },
  { key: 'draft', label: 'Nháp' },
]

function Fact({ label, value, to, tone, note }) {
  const content = (
    <>
      <span className="admin-home-fact__label">{label}</span>
      <span className={`admin-home-fact__value ${tone ? `admin-home-fact__value--${tone}` : ''}`}>
        {tone === 'critical' && <ExclamationCircleFilled aria-hidden="true" />}{value}
      </span>
      {note && <span className="admin-home-fact__note">{note}</span>}
    </>
  )
  return to
    ? <Link to={to} className="admin-home-fact admin-home-fact--link">{content}<RightOutlined className="admin-home-fact__chevron" aria-hidden="true" /></Link>
    : <div className="admin-home-fact">{content}</div>
}

export function PlatformTotals({ totals }) {
  const items = [
    { label: 'Ứng viên', value: totals.candidates, icon: <UserOutlined />, to: DASHBOARD_LINKS.candidates },
    { label: 'Nhà tuyển dụng', value: totals.employers, icon: <TeamOutlined />, to: DASHBOARD_LINKS.recruiters },
    { label: 'Công ty', value: totals.companies, icon: <ApartmentOutlined />, to: DASHBOARD_LINKS.companies },
  ]
  return (
    <section className="admin-home-totals" aria-labelledby="admin-home-totals-title">
      <h2 id="admin-home-totals-title" className="admin-home__section-title">Quy mô nền tảng</h2>
      <Link to={DASHBOARD_LINKS.activeJobs} className="admin-home-totals__hero">
        <span className="admin-home-totals__hero-value">{formatNumber(totals.jobs_active)}</span>
        <span className="admin-home-totals__hero-label">tin đang hiển thị cho ứng viên</span>
      </Link>
      <ul className="admin-home-totals__list">
        {items.map((item) => (
          <li key={item.label}>
            <Link to={item.to} className="admin-home-totals__item">
              <span className="admin-home-totals__icon" aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
              <strong>{formatNumber(item.value)}</strong>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function ApplicationFunnel({ applications, days }) {
  const { funnel, avg_first_view_hours: avgHours, stale_unviewed: stale } = applications
  const base = funnel.submitted
  return (
    <AdminPanel
      title="Phễu ứng tuyển"
      description={`Hồ sơ nộp trong ${days} ngày và giai đoạn xa nhất đã đến`}
    >
      {base === 0 ? (
        <p className="admin-home__empty">Chưa có hồ sơ nào được nộp trong kỳ này.</p>
      ) : (
        <ol className="admin-home-funnel">
          {FUNNEL_STAGES.map((stage, index) => {
            const share = ratio(funnel[stage.key], base)
            return (
              <li key={stage.key} className={`admin-home-funnel__step admin-home-funnel__step--${index}`}>
                <span className="admin-home-funnel__label">{stage.label}</span>
                <span className="admin-home-funnel__bar"><span style={{ width: `${Math.max(share * 100, 1.5)}%` }} /></span>
                <span className="admin-home-funnel__value">
                  <strong>{formatNumber(funnel[stage.key])}</strong>
                  {index > 0 && <span>{formatPercent(share)}</span>}
                </span>
              </li>
            )
          })}
        </ol>
      )}
      <div className="admin-home-facts admin-home-facts--two">
        <Fact
          label="Thời gian NTD mở hồ sơ"
          value={avgHours === null ? 'Chưa có' : `${formatNumber(avgHours)} giờ`}
          note="Trung bình từ lúc nộp"
        />
        <Fact
          label="Chưa phản hồi quá 7 ngày"
          value={formatNumber(stale)}
          tone={stale > 0 ? 'warning' : undefined}
          note="Ứng viên có thể đang chờ phản hồi"
        />
      </div>
    </AdminPanel>
  )
}

export function JobHealth({ jobs }) {
  const total = JOB_STATES.reduce((sum, state) => sum + Number(jobs.states[state.key] || 0), 0)
  return (
    <AdminPanel title="Tình trạng tin tuyển dụng" description={`${formatNumber(total)} tin trên nền tảng`}>
      <div className="admin-home-stack" role="img" aria-label={JOB_STATES.map((state) => `${state.label} ${jobs.states[state.key]}`).join(', ')}>
        {JOB_STATES.map((state) => jobs.states[state.key] > 0 && (
          <span
            key={state.key}
            className={`admin-home-stack__seg admin-home-stack__seg--${state.key}`}
            style={{ flexGrow: jobs.states[state.key] }}
          />
        ))}
      </div>
      <ul className="admin-home-legend">
        {JOB_STATES.map((state) => (
          <li key={state.key}>
            <span className={`admin-home-legend__swatch admin-home-stack__seg--${state.key}`} aria-hidden="true" />
            {state.label} <strong>{formatNumber(jobs.states[state.key])}</strong>
          </li>
        ))}
      </ul>
      <div className="admin-home-facts">
        <Fact label="Đang tuyển, chưa có hồ sơ" value={formatNumber(jobs.without_applications)} note={`${formatPercent(ratio(jobs.without_applications, jobs.states.active))} số tin đang tuyển`} />
        <Fact label="Hết hạn trong 7 ngày" value={formatNumber(jobs.expiring_soon)} />
        <Fact label="Đang tạm giữ" value={formatNumber(jobs.held)} to={DASHBOARD_LINKS.heldJobs} tone={jobs.held > 0 ? 'warning' : undefined} />
      </div>
    </AdminPanel>
  )
}

export function TrustSafety({ trust, content, days }) {
  const reportsNew = trust.job_reports.new + trust.company_reports.new
  const resolved = trust.job_reports.upheld + trust.job_reports.dismissed
    + trust.company_reports.upheld + trust.company_reports.dismissed
  const upheld = trust.job_reports.upheld + trust.company_reports.upheld
  const restricted = trust.restricted_accounts
  return (
    <AdminPanel title="An toàn và tuân thủ" description={`Báo cáo vi phạm và các hạn chế đang áp dụng, ${days} ngày qua`}>
      <div className="admin-home-facts">
        <Fact
          label="Báo cáo mới"
          value={formatNumber(reportsNew)}
          note={`${formatNumber(trust.job_reports.new)} về tin, ${formatNumber(trust.company_reports.new)} về công ty`}
        />
        <Fact
          label="Tỷ lệ xác nhận vi phạm"
          value={resolved ? formatPercent(ratio(upheld, resolved)) : 'Chưa có'}
          note={`${formatNumber(upheld)}/${formatNumber(resolved)} báo cáo đã xử lý`}
        />
        <Fact
          label="Ứng viên bị hạn chế"
          value={formatNumber(restricted.candidates)}
          to={DASHBOARD_LINKS.restrictedCandidates}
        />
        <Fact
          label="NTD bị hạn chế"
          value={formatNumber(restricted.employers)}
          to={DASHBOARD_LINKS.restrictedRecruiters}
        />
        <Fact
          label="Giữ tuân thủ đang áp dụng"
          value={formatNumber(trust.compliance_holds_active)}
          note="Do xác thực hoặc DPA hết hiệu lực"
          tone={trust.compliance_holds_active > 0 ? 'warning' : undefined}
        />
        <Fact
          label="FAQ quá hạn rà soát"
          value={formatNumber(content.knowledge_review_overdue)}
          to={DASHBOARD_LINKS.knowledgeOverdue}
          tone={content.knowledge_review_overdue > 0 ? 'warning' : undefined}
        />
      </div>
    </AdminPanel>
  )
}

export function TopCategories({ categories, days }) {
  const max = Math.max(1, ...categories.map((item) => item.active_jobs))
  return (
    <AdminPanel title="Ngành nghề nhiều tin nhất" description={`Tin đang tuyển và hồ sơ nhận được trong ${days} ngày`}>
      {categories.length === 0 ? (
        <p className="admin-home__empty">Chưa có tin đang tuyển nào được gắn ngành nghề.</p>
      ) : (
        <ol className="admin-home-ranks">
          {categories.map((item) => (
            <li key={item.public_id}>
              <span className="admin-home-ranks__name">{item.name}</span>
              <span className="admin-home-ranks__bar"><span style={{ width: `${(item.active_jobs / max) * 100}%` }} /></span>
              <span className="admin-home-ranks__value">
                <strong>{formatNumber(item.active_jobs)}</strong> tin
                <span>{formatNumber(item.applications)} hồ sơ</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </AdminPanel>
  )
}

export function AiHealth({ ai, days }) {
  const { match_analyses: match, generation } = ai
  const matchFinished = match.succeeded + match.failed
  const generationFailureRate = ratio(generation.failures, generation.invocations)
  return (
    <AdminPanel title="Hệ thống AI" description={`Đối sánh CV với tin và sinh nội dung, ${days} ngày qua`}>
      <div className="admin-home-facts">
        <Fact label="Lượt phân tích phù hợp" value={formatNumber(match.total)} />
        <Fact
          label="Phân tích thành công"
          value={matchFinished ? formatPercent(ratio(match.succeeded, matchFinished)) : 'Chưa có'}
          note={match.failed ? `${formatNumber(match.failed)} lượt lỗi` : undefined}
          tone={matchFinished && ratio(match.succeeded, matchFinished) < 0.95 ? 'warning' : undefined}
        />
        <Fact
          label="Lượt gọi mô hình sinh"
          value={formatNumber(generation.invocations)}
          note={generation.invocations ? `Lỗi ${formatPercent(generationFailureRate)}` : undefined}
          tone={generationFailureRate >= 0.05 ? 'critical' : undefined}
        />
        <Fact
          label="Thời gian phản hồi"
          value={generation.avg_latency_ms === null ? 'Chưa có' : `${formatNumber(Math.round(generation.avg_latency_ms / 100) / 10)} giây`}
          note={`${formatCompact(generation.total_tokens)} token, ${Number(generation.cost_usd).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}`}
        />
      </div>
    </AdminPanel>
  )
}
