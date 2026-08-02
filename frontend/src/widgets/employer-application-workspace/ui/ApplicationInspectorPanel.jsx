import {
  CalendarOutlined,
  CheckCircleOutlined,
  EnvironmentOutlined,
  HistoryOutlined,
  LockOutlined,
  MailOutlined,
  PhoneOutlined,
  SolutionOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Alert, Button, Empty, Input, Rate, Select, Skeleton } from 'antd'
import { RECRUITER_APPLICATION_STATUS_LABELS } from '@/entities/application'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import {
  availableStatusOptions,
  formatApplicationDate,
} from '../model/application-workspace'

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

function HistoryList({ items, loading, error, onRetry }) {
  if (loading) return <Skeleton active paragraph={{ rows: 4 }} />
  if (error) {
    return (
      <Alert
        showIcon
        type="warning"
        message="Chưa tải được lịch sử"
        description={getApiErrorMessage(error, 'Vui lòng thử lại.')}
        action={<button type="button" className="font-semibold text-amber-700" onClick={onRetry}>Thử lại</button>}
      />
    )
  }
  if (!items.length) return <p className="text-xs text-slate-400">Chưa có thay đổi trạng thái.</p>

  return (
    <ol className="space-y-0">
      {items.map((item, index) => {
        const fromLabel = RECRUITER_APPLICATION_STATUS_LABELS[item.from_status] || item.from_status
        const toLabel = RECRUITER_APPLICATION_STATUS_LABELS[item.to_status] || item.to_status
        return (
          <li key={`${item.created_at}-${item.to_status}-${index}`} className="relative pb-4 pl-6 last:pb-0">
            {index < items.length - 1 && <span className="absolute left-[5px] top-3 h-full w-px bg-slate-200" />}
            <span className="absolute left-0 top-1.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500 ring-1 ring-emerald-200" />
            <div className="text-xs font-bold text-slate-700">
              {fromLabel ? `${fromLabel} → ${toLabel}` : toLabel}
            </div>
            <p className="mt-0.5 text-[11px] leading-5 text-slate-500">
              {formatApplicationDate(item.created_at, true)}
              {item.changed_by_name ? ` · ${item.changed_by_name}` : ' · Hệ thống'}
            </p>
            {item.note && <p className="mt-1 rounded-lg bg-slate-50 p-2 text-[11px] leading-5 text-slate-600">{item.note}</p>}
          </li>
        )
      })}
    </ol>
  )
}

export default function ApplicationInspectorPanel({
  selectedApplication,
  snapshot,
  selectedPublicId,
  currentStatus,
  statuses,
  employerNote,
  employerRating,
  assessmentDirty,
  history,
  historyLoading,
  historyError,
  updating,
  onStatusChange,
  onEmployerNoteChange,
  onEmployerRatingChange,
  onSaveAssessment,
  onRetryHistory,
  className = '',
}) {
  const candidateName = snapshot?.contact_name
    || selectedApplication?.candidate_name
    || selectedApplication?.candidate_email
    || 'Ứng viên'
  const candidateEmail = snapshot?.contact_email || selectedApplication?.candidate_email
  const restricted = Boolean(selectedApplication?.candidate_account_restricted)
  const statusOptions = availableStatusOptions(currentStatus, restricted, statuses)

  return (
    <aside
      aria-labelledby="application-inspector-title"
      data-testid="application-inspector"
      className={`flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:col-span-2 md:col-start-2 md:row-start-2 xl:col-span-3 xl:col-start-10 xl:row-start-1 xl:h-full ${className}`}
    >
      <header className="border-b border-slate-100 px-4 py-3.5">
        <h2 id="application-inspector-title" className="text-base font-bold text-slate-900">
          Thông tin liên quan
        </h2>
      </header>

      {!selectedPublicId ? (
        <div className="flex min-h-[360px] flex-1 items-center justify-center p-4">
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chọn một CV để xem thông tin" />
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto bg-white">
          <section className="border-b border-slate-100 p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-lg font-bold text-slate-700">
                {(candidateName || 'U').trim().charAt(0).toLocaleUpperCase('vi-VN')}
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-black text-slate-900">{candidateName}</h3>
                <p className="mt-0.5 truncate text-xs text-slate-500">{candidateEmail || 'Chưa có email'}</p>
                {restricted && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                      <LockOutlined aria-hidden /> Bị hạn chế
                    </span>
                  </div>
                )}
              </div>
            </div>
          </section>

          {restricted && (
            <Alert
              className="!m-4"
              showIcon
              type="warning"
              message="Tài khoản ứng viên đang bị hạn chế"
              description="Bạn chỉ có thể giữ nguyên hoặc chuyển hồ sơ sang trạng thái Từ chối."
            />
          )}

          <section className="border-b border-slate-100 p-4">
            <div>
              <label htmlFor="application-status" className="text-xs font-medium text-slate-500">
                Trạng thái xử lý
              </label>
              <Select
                id="application-status"
                aria-label="Cập nhật trạng thái hồ sơ"
                className="mt-1.5 w-full"
                value={currentStatus}
                loading={updating}
                disabled={!currentStatus || statusOptions.length <= 1}
                options={statusOptions.map(([value, label]) => ({ value, label }))}
                onChange={onStatusChange}
              />
              {statusOptions.length <= 1 && currentStatus && (
                <p className="mt-1.5 text-[11px] text-slate-400">Đây là trạng thái cuối, không thể chuyển ngược.</p>
              )}
            </div>
          </section>

          <section className="space-y-3 border-b border-slate-100 p-4">
            <h3 className="text-sm font-bold text-slate-800">Liên hệ</h3>
            {!snapshot && <Skeleton active paragraph={{ rows: 3 }} />}
            {snapshot && (
              <>
                <InfoRow icon={<UserOutlined aria-hidden />} label="Người liên hệ">{candidateName}</InfoRow>
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

          <section className="space-y-3 border-b border-slate-100 p-4">
            <h3 className="text-sm font-bold text-slate-800">Thông tin ứng tuyển</h3>
            <InfoRow icon={<SolutionOutlined aria-hidden />} label="Tin tuyển dụng">
              {selectedApplication?.job_title || '—'}
            </InfoRow>
            <InfoRow icon={<CalendarOutlined aria-hidden />} label="Ngày ứng tuyển">
              {formatApplicationDate(selectedApplication?.applied_at || snapshot?.submitted_at, true)}
            </InfoRow>
            <InfoRow icon={<CheckCircleOutlined aria-hidden />} label="Nguồn hồ sơ">
              {SOURCE_LABELS[selectedApplication?.source] || selectedApplication?.source || 'Ứng tuyển trực tiếp'}
            </InfoRow>
            <InfoRow icon={<CheckCircleOutlined aria-hidden />} label="Phân tích bằng AI">
              {snapshot?.allow_ai_analysis ? 'Ứng viên đã đồng ý' : 'Không có sự đồng ý'}
            </InfoRow>
            {selectedApplication?.cover_letter && (
              <div>
                <p className="text-[11px] font-medium text-slate-400">Thư ứng tuyển</p>
                <p className="mt-1 whitespace-pre-wrap rounded-xl bg-slate-50 p-2.5 text-xs leading-5 text-slate-600">
                  {selectedApplication.cover_letter}
                </p>
              </div>
            )}
            {selectedApplication?.candidate_note && (
              <div>
                <p className="text-[11px] font-medium text-slate-400">Ghi chú của ứng viên</p>
                <p className="mt-1 whitespace-pre-wrap rounded-xl bg-slate-50 p-2.5 text-xs leading-5 text-slate-600">
                  {selectedApplication.candidate_note}
                </p>
              </div>
            )}
          </section>

          <section className="space-y-3 border-b border-slate-100 p-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Đánh giá nội bộ</h3>
              <p className="mt-1 text-[11px] leading-5 text-slate-400">Chỉ tài khoản nhà tuyển dụng của bạn nhìn thấy.</p>
            </div>
            <div>
              <p className="mb-1 text-[11px] font-semibold text-slate-500">Mức độ phù hợp</p>
              <Rate
                aria-label="Mức độ phù hợp của ứng viên"
                value={employerRating || 0}
                onChange={onEmployerRatingChange}
              />
            </div>
            <Input.TextArea
              aria-label="Ghi chú nội bộ"
              value={employerNote}
              rows={4}
              maxLength={5000}
              showCount
              placeholder="Ghi lại điểm mạnh, điều cần xác minh hoặc bước tiếp theo..."
              onChange={(event) => onEmployerNoteChange(event.target.value)}
            />
            <Button
              block
              type="primary"
              loading={updating}
              disabled={!assessmentDirty || !currentStatus}
              onClick={onSaveAssessment}
            >
              Lưu đánh giá
            </Button>
          </section>

          <section className="p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800">
              <HistoryOutlined className="text-emerald-600" aria-hidden /> Lịch sử xử lý
            </h3>
            <HistoryList
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
