export default function AdminJobReviewSummary({ job }) {
  const warningCount = [
    !job.employer_verification_completed,
    !job.employer_email_verified,
    !job.employer_phone_verified,
    Number(job.employer_account_level || 0) < 3,
  ].filter(Boolean).length

  return (
    <aside className="admin-panel admin-job-review-summary">
      <div>
        <p className="admin-job-review-summary__label">Tóm tắt kiểm tra</p>
        <strong>{warningCount ? `${warningCount} tín hiệu cần chú ý` : 'Chưa có cảnh báo tín nhiệm'}</strong>
      </div>
      <div className="admin-job-review-summary__metrics">
        <span><strong>{job.pending_report_count || 0}</strong>Báo cáo chờ</span>
        <span><strong>{job.approved_job_count || 0}</strong>Tin từng duyệt</span>
        <span><strong>{job.employer_account_level || 0}</strong>Cấp tài khoản</span>
      </div>
    </aside>
  )
}
