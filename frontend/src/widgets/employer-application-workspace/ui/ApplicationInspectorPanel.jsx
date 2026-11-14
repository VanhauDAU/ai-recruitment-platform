import {
  CalendarOutlined,
  CheckCircleOutlined,
  EnvironmentOutlined,
  HistoryOutlined,
  LockOutlined,
  MailOutlined,
  PhoneOutlined,
  SolutionOutlined,
} from '@ant-design/icons'
import { Alert, Empty, Skeleton } from 'antd'
import { Link } from 'react-router'
import { ApplicationDecisionBar } from '@/features/application-status-decision'
import { BlockCandidateButton } from '@/features/block-candidate'
import { SaveToTalentPoolButton } from '@/features/save-to-talent-pool'
import { employerAppPath } from '@/shared/config/portals'
import { formatApplicationDate, initialsOf, pendingNoticeOf } from '../model/application-workspace'
import ApplicationAssessmentSection from './ApplicationAssessmentSection'
import ApplicationHistoryTimeline from './ApplicationHistoryTimeline'
import ApplicationReviewsSection from './ApplicationReviewsSection'
import ApplicationStatusBadge from './ApplicationStatusBadge'

const SOURCE_LABELS = {
  applied: 'Ứng viên chủ động ứng tuyển',
  recommended: 'Hệ thống đề xuất',
  invited: 'Nhà tuyển dụng mời ứng tuyển',
}

function InfoRow({ icon, label, children }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium text-slate-400">{label}</p>
        <div className="mt-0.5 break-words text-xs font-semibold leading-5 text-slate-700">{children || '—'}</div>
      </div>
    </div>
  )
}

function TextBlock({ label, children }) {
  return (
    <div>
      <p className="text-[11px] font-medium text-slate-400">{label}</p>
      <p className="mt-1 whitespace-pre-wrap rounded-xl bg-slate-50 p-2.5 text-xs leading-5 text-slate-600">{children}</p>
    </div>
  )
}

/** Blocklist state, or the mass-apply signal that suggests blocking. */
function CandidateTrust({ application, candidateName }) {
  if (application.candidate_blocked) {
    return (
      <Alert
        showIcon
        type="error"
        title="Ứng viên đang trong danh sách đen"
        action={<Link to={employerAppPath('/candidate-blocks')} className="text-xs font-semibold">Quản lý</Link>}
      />
    )
  }
  const signal = application.mass_apply_signal
  if (signal) {
    return (
      <Alert
        showIcon
        type="warning"
        title="Có dấu hiệu ứng tuyển hàng loạt"
        description={`Ứng viên đã nộp vào ${signal.jobs} tin của bạn trong ${signal.window_days} ngày qua.`}
        action={<BlockCandidateButton application={application} candidateName={candidateName} />}
      />
    )
  }
  return (
    <div className="aw-secondary-actions">
      <SaveToTalentPoolButton application={application} candidateName={candidateName} block />
      <BlockCandidateButton application={application} candidateName={candidateName} block label="Chặn" />
    </div>
  )
}

export default function ApplicationInspectorPanel({
  candidateName,
  selectedApplication,
  snapshot,
  selectedPublicId,
  history,
  historyLoading,
  historyError,
  onRetryHistory,
  className = '',
}) {
  const candidateEmail = snapshot?.contact_email || selectedApplication?.candidate_email
  const restricted = Boolean(selectedApplication?.candidate_account_restricted)

  return (
    <aside
      aria-labelledby="application-inspector-title"
      data-testid="application-inspector"
      className={`flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:col-span-2 md:col-start-2 md:row-start-2 xl:col-span-3 xl:col-start-10 xl:row-start-1 xl:h-full ${className}`}
    >
      <header className="aw-panel-head">
        <h2 id="application-inspector-title" className="aw-panel-title">Xử lý hồ sơ</h2>
        {selectedApplication && <ApplicationStatusBadge status={selectedApplication.status} />}
      </header>

      {!selectedPublicId || !selectedApplication ? (
        <div className="flex min-h-[360px] flex-1 items-center justify-center p-4">
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chọn một CV để xem thông tin" />
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto bg-white">
          <section className="aw-hero space-y-3.5">
            <div className="flex items-center gap-3">
              <span className="aw-avatar">{initialsOf(candidateName)}</span>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-black text-slate-900">{candidateName}</h3>
                <p className="mt-0.5 truncate text-xs text-slate-500">{candidateEmail || 'Chưa có email'}</p>
              </div>
              {restricted && <LockOutlined title="Tài khoản bị hạn chế" className="shrink-0 text-amber-500" />}
            </div>
            {restricted && (
              <Alert
                showIcon
                type="warning"
                message="Tài khoản ứng viên đang bị hạn chế"
                description="Bạn chỉ có thể giữ nguyên hoặc chuyển hồ sơ sang Không phù hợp."
              />
            )}
            <ApplicationDecisionBar
              application={selectedApplication}
              candidateName={candidateName}
              pendingNotice={pendingNoticeOf(history)}
            />
            <CandidateTrust application={selectedApplication} candidateName={candidateName} />
          </section>

          <section className="aw-section space-y-3">
            <h3 className="aw-section__title">Liên hệ</h3>
            {!snapshot && <Skeleton active paragraph={{ rows: 3 }} />}
            {snapshot && (
              <>
                <InfoRow icon={<MailOutlined aria-hidden />} label="Email">
                  {candidateEmail ? <a className="text-slate-700 underline decoration-slate-300" href={`mailto:${candidateEmail}`}>{candidateEmail}</a> : '—'}
                </InfoRow>
                <InfoRow icon={<PhoneOutlined aria-hidden />} label="Điện thoại">
                  {snapshot.contact_phone ? <a className="text-slate-700 underline decoration-slate-300" href={`tel:${snapshot.contact_phone}`}>{snapshot.contact_phone}</a> : '—'}
                </InfoRow>
                <InfoRow icon={<EnvironmentOutlined aria-hidden />} label="Nơi làm việc mong muốn">
                  {snapshot.preferred_location_names?.join(', ') || 'Không yêu cầu'}
                </InfoRow>
              </>
            )}
          </section>

          <section className="aw-section space-y-3">
            <h3 className="aw-section__title">Thông tin ứng tuyển</h3>
            <InfoRow icon={<SolutionOutlined aria-hidden />} label="Tin tuyển dụng">
              {selectedApplication.job_title}
            </InfoRow>
            <InfoRow icon={<CalendarOutlined aria-hidden />} label="Ngày ứng tuyển">
              {formatApplicationDate(selectedApplication.applied_at || snapshot?.submitted_at, true)}
            </InfoRow>
            <InfoRow icon={<CheckCircleOutlined aria-hidden />} label="Nguồn hồ sơ">
              {SOURCE_LABELS[selectedApplication.source] || selectedApplication.source || 'Ứng tuyển trực tiếp'}
            </InfoRow>
            <InfoRow icon={<CheckCircleOutlined aria-hidden />} label="Phân tích bằng AI">
              {snapshot?.allow_ai_analysis ? 'Ứng viên đã đồng ý' : 'Không có sự đồng ý'}
            </InfoRow>
            {selectedApplication.cover_letter && <TextBlock label="Thư ứng tuyển">{selectedApplication.cover_letter}</TextBlock>}
            {selectedApplication.candidate_note && <TextBlock label="Ghi chú của ứng viên">{selectedApplication.candidate_note}</TextBlock>}
          </section>

          <ApplicationReviewsSection publicId={selectedApplication.public_id} />

          <ApplicationAssessmentSection key={selectedApplication.public_id} application={selectedApplication} />

          <section className="aw-section">
            <h3 className="aw-section__title">
              <HistoryOutlined className="text-emerald-600" aria-hidden /> Lịch sử xử lý
            </h3>
            <ApplicationHistoryTimeline
              items={history}
              loading={historyLoading}
              error={historyError}
              onRetry={onRetryHistory}
            />
          </section>
        </div>
      )}
    </aside>
  )
}
