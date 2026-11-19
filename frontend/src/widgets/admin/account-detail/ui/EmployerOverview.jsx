import { Button } from 'antd'
import { AccountActivityTimeline, formatAdminDate } from '@/entities/account/admin-account'
import { formatElapsed } from '@/shared/lib/date-time'

const COUNT_LABELS = {
  recruitment_needs: 'Nhu cầu tuyển dụng',
  jobs: 'Tin tuyển dụng',
  campaigns: 'Chiến dịch',
  verification_documents: 'Giấy tờ xác thực',
}

function Fact({ label, children }) {
  return (
    <div className="recruiter-fact">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

/** Employer "Tổng quan": the facts to act on and recent activity first, the full profile below. */
export default function EmployerOverview({ account, profilePanel, onOpenTab }) {
  const context = account.context || {}
  const verification = context.verification || {}
  const waiting = ['pending', 'in_review'].includes(verification.status) && verification.submitted_at
  const counts = account.section_counts || {}

  return (
    <div className="recruiter-overview">
      <div className="recruiter-overview__top" aria-label="Tóm tắt nhà tuyển dụng" role="group">
        <section className="admin-panel recruiter-overview__card">
          <h3>Tóm tắt</h3>
          <dl className="recruiter-facts">
            <Fact label="Công ty">{context.company?.name || 'Chưa liên kết'}</Fact>
            <Fact label="Vai trò">{context.company_role_label || 'Chưa có'}</Fact>
            <Fact label="Xác thực">
              {verification.status_label || 'Chưa nộp'}
              {waiting ? ` · chờ ${formatElapsed(verification.submitted_at)}` : ''}
            </Fact>
            <Fact label="Email">{account.email_verified ? 'Đã xác minh' : 'Chưa xác minh'}</Fact>
            <Fact label="Điện thoại">{context.phone_verified ? 'Đã xác minh' : 'Chưa xác minh'}</Fact>
            <Fact label="Phiên đang mở">{account.active_session_count ?? 0}</Fact>
            <Fact label="Đăng nhập gần nhất">{formatAdminDate(account.last_login, 'Chưa từng đăng nhập')}</Fact>
            <Fact label="Tham gia">{formatAdminDate(account.date_joined)}</Fact>
            {Object.entries(COUNT_LABELS).map(([key, label]) => (
              <Fact key={key} label={label}>{counts[key] ?? 0}</Fact>
            ))}
          </dl>
        </section>
        <section className="admin-panel recruiter-overview__card">
          <div className="recruiter-overview__card-head">
            <h3>Hoạt động gần đây</h3>
            <Button size="small" type="link" onClick={() => onOpenTab('activity')}>Xem toàn bộ nhật ký</Button>
          </div>
          <AccountActivityTimeline compact publicId={account.public_id} />
        </section>
      </div>
      {profilePanel}
    </div>
  )
}
