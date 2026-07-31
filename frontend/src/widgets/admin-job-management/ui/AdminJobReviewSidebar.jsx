import {
  CheckCircleOutlined,
  ContactsOutlined,
  ExclamationCircleOutlined,
  FlagOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Alert, Empty, Space, Tag } from 'antd'
import { Link } from 'react-router'
import { adminPath } from '@/shared/config/portals'
import { adminJobEnumLabel } from '../model/detail-presentation'
import AdminJobDisclosure from './AdminJobDisclosure'

function TrustSignal({ ok, children }) {
  return (
    <div className={`admin-job-trust-signal ${ok ? 'admin-job-trust-signal--ok' : 'admin-job-trust-signal--warn'}`}>
      {ok ? <CheckCircleOutlined /> : <ExclamationCircleOutlined />}
      <span>{children}</span>
    </div>
  )
}

function DetailRows({ items }) {
  return (
    <dl className="admin-job-detail-rows">
      {items.map((item) => (
        <div key={item.key}>
          <dt>{item.label}</dt>
          <dd>{item.value || '—'}</dd>
        </div>
      ))}
    </dl>
  )
}

export default function AdminJobReviewSidebar({
  job,
  openSections,
  onToggle,
  canViewEmployerProfile,
}) {
  const warningCount = [
    job.company_verification_status !== 'verified',
    !job.employer_email_verified,
    !job.employer_phone_verified,
    Number(job.employer_account_level || 0) < 3,
  ].filter(Boolean).length

  return (
    <aside className="admin-job-review-sidebar">
      <section className="admin-panel admin-job-review-summary">
        <div>
          <p className="admin-job-review-summary__label">Tóm tắt kiểm tra</p>
          <strong>{warningCount ? `${warningCount} tín hiệu cần chú ý` : 'Chưa có cảnh báo tín nhiệm'}</strong>
        </div>
        <div className="admin-job-review-summary__metrics">
          <span><strong>{job.pending_report_count || 0}</strong>Báo cáo chờ</span>
          <span><strong>{job.approved_job_count || 0}</strong>Tin từng duyệt</span>
          <span><strong>{job.employer_account_level || 0}</strong>Cấp tài khoản</span>
        </div>
      </section>

      <AdminJobDisclosure
        badge={warningCount ? `${warningCount} lưu ý` : 'Ổn định'}
        compact
        description="Pháp nhân, tài khoản và lịch sử đăng tin"
        icon={<SafetyCertificateOutlined />}
        onToggle={onToggle}
        open={openSections.has('employer')}
        sectionKey="employer"
        title="Tín hiệu nhà tuyển dụng"
      >
        <div className="space-y-2">
          <TrustSignal ok={job.company_verification_status === 'verified'}>
            Pháp nhân: {job.company_verification_status === 'verified' ? 'đã xác thực' : 'chưa xác thực'}
          </TrustSignal>
          <TrustSignal ok={job.employer_email_verified}>
            Email: {job.employer_email_verified ? 'đã xác thực' : 'chưa xác thực'}
          </TrustSignal>
          <TrustSignal ok={job.employer_phone_verified}>
            Điện thoại: {job.employer_phone_verified ? 'đã xác thực' : 'chưa xác thực'}
          </TrustSignal>
          <TrustSignal ok={job.employer_account_level >= 3}>
            Cấp tài khoản {job.employer_account_level || 0}
          </TrustSignal>
        </div>
        <DetailRows items={[
          { key: 'employer', label: 'Người đăng', value: job.employer_name },
          { key: 'email', label: 'Email tài khoản', value: job.employer_email },
          { key: 'role', label: 'Vai trò công ty', value: job.company_role_label },
          { key: 'status', label: 'Tình trạng', value: adminJobEnumLabel(job.employer_account_status) },
        ]} />
        {canViewEmployerProfile && (
          <Link className="admin-job-inline-link" to={adminPath(`/recruiters/${job.employer_public_id}`)}>
            <UserOutlined /> Xem hồ sơ nhà tuyển dụng
          </Link>
        )}
      </AdminJobDisclosure>

      <AdminJobDisclosure
        badge={job.can_view_sensitive_contact ? 'Theo quyền' : 'Bị giới hạn'}
        compact
        description="Ẩn mặc định vì chứa dữ liệu nhạy cảm"
        icon={<ContactsOutlined />}
        onToggle={onToggle}
        open={openSections.has('contact')}
        sectionKey="contact"
        title="Thông tin nhận hồ sơ"
      >
        {!job.can_view_sensitive_contact ? (
          <Alert showIcon title="Bạn không có quyền xem thông tin liên hệ nhạy cảm." type="info" />
        ) : job.application_contact ? (
          <DetailRows items={[
            { key: 'recipient', label: 'Người nhận', value: job.application_contact.recipient_name },
            { key: 'phone', label: 'Điện thoại', value: job.application_contact.phone },
            { key: 'emails', label: 'Email', value: job.application_contact.emails?.map((item) => item.email).join(', ') },
          ]} />
        ) : <Empty description="Chưa có thông tin liên hệ" image={Empty.PRESENTED_IMAGE_SIMPLE} />}
      </AdminJobDisclosure>

      <AdminJobDisclosure
        badge={`${job.pending_report_count || 0} đang chờ`}
        compact
        description="Phản ánh liên quan trực tiếp đến tin này"
        icon={<FlagOutlined />}
        onToggle={onToggle}
        open={openSections.has('reports')}
        sectionKey="reports"
        title="Báo cáo liên quan"
      >
        {job.reports?.length ? (
          <div className="admin-job-report-list">
            {job.reports.map((report) => (
              <div key={report.public_id}>
                <Space wrap size={[4, 4]}>
                  <strong>{report.reason_label}</strong>
                  <Tag>{adminJobEnumLabel(report.status)}</Tag>
                </Space>
                <p>{report.detail || report.resolution_note || 'Không có mô tả'}</p>
              </div>
            ))}
          </div>
        ) : <Empty description="Chưa có báo cáo" image={Empty.PRESENTED_IMAGE_SIMPLE} />}
      </AdminJobDisclosure>
    </aside>
  )
}

